import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from 'src/audit/audit.service';
import { Permission } from 'src/auth/policy/permissions';
import {
  assertOwnerOrPermission,
  OwnershipActor,
} from 'src/auth/policy/ownership';

import { Order, OrderDocument } from './order.schema';

import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

import { OrderStatus } from './enums/order-status';
import { PaymentStatus } from './enums/payment-status';
import { ProductService } from 'src/product/product.service';
import { EventService } from 'src/event/event.service';
import { VoucherService } from 'src/voucher/voucher.service';
import { isPromotionEligibleProduct } from '../product/helper/promotion-product-eligibility';
import { ORDER_STATUS, PAYMENT_STATUS } from 'src/config.global';

const ORDER_CANCEL_NOT_ALLOWED = 'ORDER_CANCEL_NOT_ALLOWED';
const ORDER_STATUS_TRANSITION_NOT_ALLOWED = 'ORDER_STATUS_TRANSITION_NOT_ALLOWED';
const ORDER_CANCELLATION_REASON_REQUIRED = 'ORDER_CANCELLATION_REASON_REQUIRED';
const MAX_ORDER_CODE_GENERATION_ATTEMPTS = 5;

const VALID_STAFF_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PROCESSING]: [
    OrderStatus.SHIPPING,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.SHIPPING]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

type InventoryTransitionTarget = 'RESERVED' | 'COMMITTED' | 'RELEASED';
type InventoryStatusValue = 'NONE' | 'RESERVED' | 'COMMITTED' | 'RELEASED';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly productService: ProductService,
    private readonly auditService: AuditService,
    private readonly eventService: EventService,
    private readonly voucherService: VoucherService,
  ) {}

  async create(dto: CreateOrderDto, userId: string) {
    const fullName = dto.fullName.trim();
    const phone = dto.phone.trim();
    const address = dto.address.trim();
    const note = dto.note?.trim();

    if (!fullName || !phone || !address) {
      throw this.createCheckoutError(
        'CHECKOUT_ADDRESS_INVALID',
        'Shipping information is required before checkout.',
        {
          fields: {
            fullName: Boolean(fullName),
            phone: Boolean(phone),
            address: Boolean(address),
          },
        },
      );
    }

    if (!/^[0-9+()-]{8,15}$/.test(phone.replace(/\s+/g, ''))) {
      throw this.createCheckoutError(
        'CHECKOUT_ADDRESS_INVALID',
        'Phone number format is invalid.',
      );
    }

    const {
      items,
      subtotalAmount,
      productDiscountAmount,
      promotionAdjustments,
    } = await this.buildValidatedOrderItems(dto.items);

    const voucherCode = dto.voucherCode?.trim();
    const voucherReservation = voucherCode
      ? await this.voucherService.reserveForOrder(voucherCode, subtotalAmount)
      : null;
    const voucherDiscountAmount = voucherReservation?.discountAmount ?? 0;
    const totalAmount = Math.max(0, subtotalAmount - voucherDiscountAmount);

    if (voucherReservation) {
      promotionAdjustments.push({
        type: 'voucher',
        voucherId: voucherReservation.voucherId,
        voucherCode: voucherReservation.code,
        code: voucherReservation.code,
        amount: voucherReservation.discountAmount,
        description: `Voucher ${voucherReservation.code}`,
      });
    }

    if (totalAmount <= 0) {
      if (voucherReservation?.reservedUsage) {
        await this.voucherService.restoreReservation(voucherReservation.voucherId);
      }
      throw this.createCheckoutError(
        'CHECKOUT_TOTAL_CHANGED',
        'Order total changed. Please review your cart and checkout again.',
      );
    }

    const orderData: Partial<Order> = {
      userId,
      note,
      items,
      phone,
      address,
      fullName,
      subtotalAmount,
      productDiscountAmount,
      voucherDiscountAmount,
      promotionAdjustments,
      ...(voucherReservation && { voucherSnapshot: voucherReservation }),
      totalAmount,
      paymentMethod: dto.paymentMethod,
      orderStatus: ORDER_STATUS.PROCESSING,
      paymentStatus: PAYMENT_STATUS.PENDING,
    };

    let createdOrder: any;
    try {
      createdOrder = await this.saveOrderWithUniqueCode(orderData);
      await this.applyInventoryTransition(
        String(createdOrder._id),
        'RESERVED',
        'order:create',
      );
    } catch (error) {
      if (createdOrder?._id) {
        await this.orderModel.findByIdAndDelete(createdOrder._id);
      }
      if (voucherReservation?.reservedUsage) {
        await this.voucherService.restoreReservation(voucherReservation.voucherId);
      }
      throw error;
    }

    const hydratedOrder = await this.orderModel.findById(createdOrder._id);
    return hydratedOrder ?? createdOrder;
  }

  private async saveOrderWithUniqueCode(orderData: Partial<Order>) {
    const attemptedOrderCodes = new Set<string>();

    for (let attempt = 0; attempt < MAX_ORDER_CODE_GENERATION_ATTEMPTS; attempt += 1) {
      const orderCode = await this.generateUniqueOrderCode(new Date(), attemptedOrderCodes);
      attemptedOrderCodes.add(orderCode);

      try {
        return await new this.orderModel({ ...orderData, orderCode }).save();
      } catch (error) {
        if (this.isDuplicateOrderCodeError(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException({
      message: 'Order code generation conflict',
      description: 'Unable to reserve a unique order code. Please try again.',
      detail: { code: 'ORDER_CODE_CONFLICT' },
    });
  }

  private async generateUniqueOrderCode(
    issuedAt: Date,
    attemptedOrderCodes: Set<string>,
  ) {
    const dateStr = issuedAt.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `DH${dateStr}-`;
    const latestOrder = (await this.orderModel
      .findOne({ orderCode: { $regex: `^${prefix}\\d+$` } })
      .sort({ orderCode: -1 })
      .select('orderCode')
      .lean()
      .exec()) as { orderCode?: string } | null;

    const latestSequence = this.parseOrderCodeSequence(latestOrder?.orderCode);
    let nextSequence = latestSequence + 1;
    let orderCode = this.formatOrderCode(prefix, nextSequence);

    while (attemptedOrderCodes.has(orderCode)) {
      nextSequence += 1;
      orderCode = this.formatOrderCode(prefix, nextSequence);
    }

    return orderCode;
  }

  private parseOrderCodeSequence(orderCode?: string) {
    const match = orderCode?.match(/-(\d+)$/);
    return match ? Number(match[1]) : 0;
  }

  private formatOrderCode(prefix: string, sequence: number) {
    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }

  private isDuplicateOrderCodeError(error: unknown) {
    const mongoError = error as {
      code?: number;
      keyPattern?: Record<string, unknown>;
      keyValue?: Record<string, unknown>;
    };

    return (
      mongoError?.code === 11000 &&
      (mongoError.keyPattern?.orderCode === 1 || mongoError.keyValue?.orderCode)
    );
  }

  private createCheckoutError(
    code:
      | 'CHECKOUT_ITEM_NOT_FOUND'
      | 'CHECKOUT_ITEM_UNAVAILABLE'
      | 'CHECKOUT_STOCK_CHANGED'
      | 'CHECKOUT_PRICE_CHANGED'
      | 'CHECKOUT_TOTAL_CHANGED'
      | 'CHECKOUT_ADDRESS_INVALID',
    description: string,
    detail: Record<string, unknown> = {},
  ) {
    return new BadRequestException({
      message: 'Checkout validation failed',
      description,
      detail: {
        code,
        ...detail,
      },
    });
  }

  private buildSnapshotProduct(item: Record<string, any>) {
    const rawProductId = item.productId;
    const fallbackId =
      typeof rawProductId === 'string'
        ? rawProductId
        : typeof rawProductId?.toString === 'function'
          ? rawProductId.toString()
          : '';

    return {
      _id: fallbackId,
      slug: item.productSlug,
      name: item.productName,
      images: item.productImage ? [item.productImage] : [],
      price: item.unitPrice,
      discountPrice: item.finalPrice,
    };
  }

  private toSnapshotSafeOrder(order: Record<string, any>) {
    const plainOrder =
      typeof order?.toObject === 'function' ? order.toObject() : { ...order };
    const rawItems = Array.isArray(plainOrder?.items) ? plainOrder.items : [];

    const items = rawItems.map((rawItem: Record<string, any>) => {
      const plainItem =
        typeof rawItem?.toObject === 'function' ? rawItem.toObject() : rawItem;
      const rawProduct = plainItem?.productId;
      const populatedProduct =
        rawProduct && typeof rawProduct === 'object'
          ? typeof rawProduct.toObject === 'function'
            ? rawProduct.toObject()
            : rawProduct
          : null;

      const snapshotProduct = this.buildSnapshotProduct(plainItem);
      const mergedProduct = populatedProduct
        ? {
            ...populatedProduct,
            ...snapshotProduct,
            _id: populatedProduct._id ?? snapshotProduct._id,
            slug: snapshotProduct.slug ?? populatedProduct.slug,
            name: snapshotProduct.name ?? populatedProduct.name,
            images: snapshotProduct.images.length > 0
              ? snapshotProduct.images
              : Array.isArray(populatedProduct.images)
                ? populatedProduct.images
                : [],
            price: snapshotProduct.price ?? populatedProduct.price,
            discountPrice:
              snapshotProduct.discountPrice ?? populatedProduct.discountPrice,
          }
        : snapshotProduct;

      return {
        ...plainItem,
        productId: mergedProduct,
      };
    });

    return {
      ...plainOrder,
      items,
    };
  }

  private assertCustomerCancellationAllowed(
    order: Pick<Order, 'orderStatus' | 'paymentStatus'>,
  ) {
    const isAllowed =
      order.orderStatus === ORDER_STATUS.PROCESSING &&
      order.paymentStatus === PAYMENT_STATUS.PENDING;

    if (isAllowed) {
      return;
    }

    throw new ConflictException({
      message: 'Order cancellation is not allowed',
      description:
        'Only processing orders with pending payment can be cancelled by customers.',
      detail: {
        code: ORDER_CANCEL_NOT_ALLOWED,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
      },
    });
  }

  private async restoreVoucherReservationIfEligible(
    order: Pick<Order, 'orderStatus' | 'paymentStatus' | 'voucherSnapshot'>,
    orderId: string,
  ) {
    const voucherSnapshot = order.voucherSnapshot;

    if (
      !voucherSnapshot?.reservedUsage ||
      voucherSnapshot.restoredAt ||
      order.orderStatus === ORDER_STATUS.COMPLETED ||
      order.paymentStatus === PAYMENT_STATUS.PAID
    ) {
      return;
    }

    await this.voucherService.restoreReservation(voucherSnapshot.voucherId);
    await this.orderModel.findByIdAndUpdate(
      orderId,
      { $set: { 'voucherSnapshot.restoredAt': new Date() } },
      { new: true },
    );
  }
  private async buildValidatedOrderItems(items: CreateOrderDto['items']) {
    if (!Array.isArray(items) || items.length === 0) {
      throw this.createCheckoutError(
        'CHECKOUT_ITEM_NOT_FOUND',
        'Checkout requires at least one item.',
      );
    }

    const duplicateIds = new Set<string>();
    const seenProductIds = new Set<string>();

    for (const item of items) {
      const productId = String(item.productId ?? '').trim();

      if (seenProductIds.has(productId)) {
        duplicateIds.add(productId);
      }

      seenProductIds.add(productId);
    }

    if (duplicateIds.size > 0) {
      throw this.createCheckoutError(
        'CHECKOUT_ITEM_NOT_FOUND',
        'Duplicate checkout items are not allowed.',
        { items: Array.from(duplicateIds) },
      );
    }

    const validatedItems = [] as Array<{
      productId: string;
      quantity: number;
      productName: string;
      productSlug: string;
      productImage: string;
      unitPrice: number;
      finalPrice: number;
      lineTotal: number;
      eventTag?: string;
      eventName?: string;
      originalPrice?: number;
      promotionStatus?: string;
    }>;
    const promotionAdjustments: Array<{
      type: 'flash_sale' | 'voucher';
      code?: string;
      eventTag?: string;
      eventName?: string;
      voucherId?: string;
      voucherCode?: string;
      amount: number;
      description?: string;
    }> = [];

    for (const item of items) {
      const productId = String(item.productId ?? '').trim();
      const quantity = Number(item.quantity);

      if (!productId || !Number.isInteger(quantity) || quantity < 1) {
        throw this.createCheckoutError(
          'CHECKOUT_ITEM_NOT_FOUND',
          'Checkout item data is invalid.',
          {
            item: {
              productId,
              quantity: item.quantity,
            },
          },
        );
      }

      let product: any;

      try {
        product = await this.productService.findOne(productId);
      } catch {
        throw this.createCheckoutError(
          'CHECKOUT_ITEM_NOT_FOUND',
          'One or more products no longer exist.',
          { items: [{ productId }] },
        );
      }

      const productName = String(product.name ?? '').trim();
      const productSlug = String(product.slug ?? '').trim();
      const productImage =
        Array.isArray(product.images) && product.images.length > 0
          ? String(product.images[0])
          : '';

      if (!productName || !productSlug || !productImage) {
        throw this.createCheckoutError(
          'CHECKOUT_ITEM_UNAVAILABLE',
          'One or more products are unavailable for checkout.',
          { items: [{ productId }] },
        );
      }

      const availableStock = Number(product.stock ?? 0);

      if (availableStock < quantity) {
        throw this.createCheckoutError(
          'CHECKOUT_STOCK_CHANGED',
          'Stock changed for one or more products.',
          {
            items: [
              {
                productId,
                requestedQuantity: quantity,
                availableStock,
              },
            ],
          },
        );
      }

      const unitPrice = Number(product.price ?? 0);
      const discountPrice = Number(product.discountPrice ?? unitPrice);
      const promotionEligible = isPromotionEligibleProduct(product);
      let activeEvent: Record<string, any> | null = null;

      if (product.event) {
        activeEvent = await this.eventService.findActiveFlashSaleByTag(product.event);
      }

      let finalPrice = unitPrice;
      let promotionStatus = product.event ? 'inactive' : 'none';
      const eventTag = activeEvent?.tag ?? product.event;
      const eventName = activeEvent?.name;

      if (activeEvent && promotionEligible) {
        finalPrice = discountPrice;
        promotionStatus = activeEvent.status ?? 'active';
      } else if (activeEvent && !promotionEligible) {
        promotionStatus = 'ineligible';
      }

      if (
        !Number.isFinite(unitPrice) ||
        !Number.isFinite(finalPrice) ||
        unitPrice < 0 ||
        finalPrice < 0
      ) {
        throw this.createCheckoutError(
          'CHECKOUT_TOTAL_CHANGED',
          'Product pricing changed. Please review your cart.',
          { items: [{ productId }] },
        );
      }

      if (
        item.clientFinalPrice !== undefined &&
        Number(item.clientFinalPrice) !== finalPrice
      ) {
        throw this.createCheckoutError(
          'CHECKOUT_PRICE_CHANGED',
          'Promotion pricing changed. Please review your cart.',
          {
            items: [
              {
                productId,
                previousFinalPrice: Number(item.clientFinalPrice),
                currentFinalPrice: finalPrice,
                promotionStatus,
                promotionEligible,
                eventTag,
                eventName,
              },
            ],
          },
        );
      }

      const lineTotal = finalPrice * quantity;
      const productDiscount = Math.max(0, unitPrice - finalPrice) * quantity;

      validatedItems.push({
        productId,
        quantity,
        productName,
        productSlug,
        productImage,
        unitPrice,
        finalPrice,
        lineTotal,
        eventTag,
        eventName,
        originalPrice: unitPrice,
        promotionStatus,
      });

      if (productDiscount > 0) {
        promotionAdjustments.push({
          type: 'flash_sale',
          eventTag,
          eventName,
          amount: productDiscount,
          description: eventName
            ? `Flash sale ${eventName}`
            : 'Flash sale discount',
        });
      }
    }

    const subtotalAmount = validatedItems.reduce(
      (sum, item) => sum + item.lineTotal,
      0,
    );
    const productDiscountAmount = promotionAdjustments
      .filter((adjustment) => adjustment.type === 'flash_sale')
      .reduce((sum, adjustment) => sum + adjustment.amount, 0);

    return {
      items: validatedItems,
      subtotalAmount,
      productDiscountAmount,
      promotionAdjustments,
    };
  }

  private normalizeInventoryStatus(
    status: Order['inventoryStatus'] | null | undefined,
  ): InventoryStatusValue {
    if (
      status === 'NONE' ||
      status === 'RESERVED' ||
      status === 'COMMITTED' ||
      status === 'RELEASED'
    ) {
      return status;
    }

    return 'NONE';
  }

  private resolveItemProductId(rawProductId: unknown) {
    if (typeof rawProductId === 'string') {
      return rawProductId;
    }

    if (
      rawProductId &&
      typeof rawProductId === 'object' &&
      '_id' in (rawProductId as Record<string, unknown>)
    ) {
      return String((rawProductId as Record<string, unknown>)._id ?? '').trim();
    }

    if (rawProductId && typeof (rawProductId as { toString?: unknown }).toString === 'function') {
      return String(rawProductId).trim();
    }

    return '';
  }

  async applyInventoryTransition(
    orderId: string,
    targetState: InventoryTransitionTarget,
    source: string,
  ) {
    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const currentStatus = this.normalizeInventoryStatus(order.inventoryStatus);

    if (targetState === 'RESERVED') {
      if (['RESERVED', 'COMMITTED', 'RELEASED'].includes(currentStatus)) {
        return;
      }

      const preTransition = await this.orderModel.findOneAndUpdate(
        {
          _id: orderId,
          inventoryReservedAt: { $exists: false },
          inventoryCommittedAt: { $exists: false },
          inventoryReleasedAt: { $exists: false },
          $or: [{ inventoryStatus: 'NONE' }, { inventoryStatus: { $exists: false } }],
        },
        {
          $set: {
            inventoryStatus: 'RESERVED',
            inventoryReservedAt: new Date(),
          },
        },
        { new: false },
      );

      if (!preTransition) {
        return;
      }

      const decrementedItems: Array<{ productId: string; quantity: number }> = [];

      for (const rawItem of preTransition.items ?? []) {
        const quantity = Number((rawItem as unknown as Record<string, unknown>).quantity ?? 0);
        const productId = this.resolveItemProductId(
          (rawItem as unknown as Record<string, unknown>).productId,
        );

        if (!productId || !Number.isInteger(quantity) || quantity < 1) {
          continue;
        }

        const updatedProduct = await this.productService.decreaseStock(
          productId,
          quantity,
        );

        if (!updatedProduct) {
          await Promise.all(
            decrementedItems.map((item) =>
              this.productService.increaseStock(item.productId, item.quantity),
            ),
          );

          await this.orderModel.findByIdAndUpdate(orderId, {
            $set: { inventoryStatus: 'NONE' },
            $unset: { inventoryReservedAt: 1 },
          });

          throw this.createCheckoutError(
            'CHECKOUT_STOCK_CHANGED',
            'Stock changed for one or more products.',
            {
              source,
              items: [
                {
                  productId,
                  requestedQuantity: quantity,
                },
              ],
            },
          );
        }

        decrementedItems.push({ productId, quantity });
      }

      return;
    }

    if (targetState === 'COMMITTED') {
      if (['COMMITTED', 'RELEASED'].includes(currentStatus)) {
        return;
      }

      const preTransition = await this.orderModel.findOneAndUpdate(
        {
          _id: orderId,
          inventoryCommittedAt: { $exists: false },
          inventoryReleasedAt: { $exists: false },
          $or: [
            { inventoryStatus: 'NONE' },
            { inventoryStatus: 'RESERVED' },
            { inventoryStatus: { $exists: false } },
          ],
        },
        {
          $set: {
            inventoryStatus: 'COMMITTED',
            inventoryCommittedAt: new Date(),
          },
        },
        { new: false },
      );

      if (!preTransition) {
        return;
      }

      const previousStatus = this.normalizeInventoryStatus(preTransition.inventoryStatus);
      const shouldDecreaseStock = previousStatus !== 'RESERVED';
      const decreasedItems: Array<{ productId: string; quantity: number }> = [];
      const soldItems: Array<{ productId: string; quantity: number }> = [];

      try {
        for (const rawItem of preTransition.items ?? []) {
          const quantity = Number((rawItem as unknown as Record<string, unknown>).quantity ?? 0);
          const productId = this.resolveItemProductId(
            (rawItem as unknown as Record<string, unknown>).productId,
          );

          if (!productId || !Number.isInteger(quantity) || quantity < 1) {
            continue;
          }

          if (shouldDecreaseStock) {
            const updatedProduct = await this.productService.decreaseStock(
              productId,
              quantity,
            );

            if (!updatedProduct) {
              throw this.createCheckoutError(
                'CHECKOUT_STOCK_CHANGED',
                'Stock changed for one or more products.',
                {
                  source,
                  items: [
                    {
                      productId,
                      requestedQuantity: quantity,
                    },
                  ],
                },
              );
            }

            decreasedItems.push({ productId, quantity });
          }

          await this.productService.increaseSoldQuantity(productId, quantity);
          soldItems.push({ productId, quantity });
        }
      } catch (error) {
        await Promise.all(
          soldItems.map((item) =>
            this.productService.decreaseSoldQuantity(item.productId, item.quantity),
          ),
        );

        await Promise.all(
          decreasedItems.map((item) =>
            this.productService.increaseStock(item.productId, item.quantity),
          ),
        );

        const rollbackSet: Record<string, unknown> = {
          inventoryStatus: previousStatus,
        };
        const rollbackUnset: Record<string, number> = {
          inventoryCommittedAt: 1,
        };

        if (preTransition.inventoryReservedAt) {
          rollbackSet.inventoryReservedAt = preTransition.inventoryReservedAt;
        } else {
          rollbackUnset.inventoryReservedAt = 1;
        }

        await this.orderModel.findByIdAndUpdate(orderId, {
          $set: rollbackSet,
          $unset: rollbackUnset,
        });

        throw error;
      }

      if (!preTransition.inventoryReservedAt) {
        await this.orderModel.findByIdAndUpdate(
          {
            _id: orderId,
            inventoryReservedAt: { $exists: false },
          },
          {
            $set: {
              inventoryReservedAt: new Date(),
            },
          },
        );
      }

      return;
    }

    if (currentStatus === 'RELEASED' || currentStatus === 'COMMITTED') {
      return;
    }

    const preTransition = await this.orderModel.findOneAndUpdate(
      {
        _id: orderId,
        inventoryReleasedAt: { $exists: false },
        inventoryCommittedAt: { $exists: false },
        $or: [
          { inventoryStatus: 'NONE' },
          { inventoryStatus: 'RESERVED' },
          { inventoryStatus: { $exists: false } },
        ],
      },
      {
        $set: {
          inventoryStatus: 'RELEASED',
          inventoryReleasedAt: new Date(),
        },
      },
      { new: false },
    );

    if (!preTransition) {
      return;
    }

    const previousStatus = this.normalizeInventoryStatus(preTransition.inventoryStatus);

    if (previousStatus !== 'RESERVED') {
      return;
    }

    const releasedItems: Array<{ productId: string; quantity: number }> = [];

    try {
      for (const rawItem of preTransition.items ?? []) {
        const quantity = Number((rawItem as unknown as Record<string, unknown>).quantity ?? 0);
        const productId = this.resolveItemProductId(
          (rawItem as unknown as Record<string, unknown>).productId,
        );

        if (!productId || !Number.isInteger(quantity) || quantity < 1) {
          continue;
        }

        await this.productService.increaseStock(productId, quantity);
        releasedItems.push({ productId, quantity });
      }
    } catch (error) {
      await Promise.all(
        releasedItems.map((item) =>
          this.productService.decreaseStock(item.productId, item.quantity),
        ),
      );

      const rollbackSet: Record<string, unknown> = {
        inventoryStatus: previousStatus,
      };
      const rollbackUnset: Record<string, number> = {
        inventoryReleasedAt: 1,
      };

      if (preTransition.inventoryReservedAt) {
        rollbackSet.inventoryReservedAt = preTransition.inventoryReservedAt;
      } else {
        rollbackUnset.inventoryReservedAt = 1;
      }

      await this.orderModel.findByIdAndUpdate(orderId, {
        $set: rollbackSet,
        $unset: rollbackUnset,
      });

      throw error;
    }
  }

  async updateOrderPaymentStatus(
    orderId: string,
    status: 'PAID' | 'CANCELLED' | 'PENDING',
  ) {
    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    order.paymentStatus = status;
    return await order.save();
  }

  async findMyOrders(
    userId: string,
    {
      page = 1,
      limit = 10,
      search,
      sortBy = '-createdAt',
      fields,
      orderStatus,
    }: {
      page?: number;
      limit?: number;
      search?: string;
      sortBy?: string;
      fields?: string;
      orderStatus?: string;
    },
  ) {
    const query: any = { userId };

    if (orderStatus) {
      query.orderStatus = orderStatus;
    }

    if (search) {
      if (Types.ObjectId.isValid(search) && search.length === 24) {
        query._id = new Types.ObjectId(search);
      } else {
        query.orderCode = { $regex: search, $options: 'i' };
      }
    }

    let projection = {};
    if (fields) {
      projection = fields.split(',').reduce((acc, field) => {
        acc[field.trim()] = 1;
        return acc;
      }, {} as any);
    }

    const total = await this.orderModel.countDocuments(query);

    const data = await this.orderModel
      .find(query, projection)
      .populate({
        path: 'items.productId',
        select: '-description',
      })
      .sort(sortBy)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    const snapshotSafeOrders = data.map((order) =>
      this.toSnapshotSafeOrder(order as unknown as Record<string, any>),
    );

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: snapshotSafeOrders,
    };
  }

  async findOrders({
    page = 1,
    limit = 10,
    search,
    sortBy = '-createdAt',
    fields,
    orderStatus,
    paymentStatus,
    paymentMethod,
    totalFrom,
    totalTo,
    dateFrom,
    dateTo,
  }: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    fields?: string;
    orderStatus?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    totalFrom?: number;
    totalTo?: number;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const query: any = {};

    if (orderStatus) query.orderStatus = { $in: orderStatus.split(',') };
    if (paymentStatus) query.paymentStatus = { $in: paymentStatus.split(',') };
    if (paymentMethod) query.paymentMethod = { $in: paymentMethod.split(',') };

    if (search) {
      const normalizedSearch = search.trim().slice(0, 100);
      if (Types.ObjectId.isValid(normalizedSearch) && normalizedSearch.length === 24) {
        query._id = new Types.ObjectId(normalizedSearch);
      } else if (normalizedSearch) {
        const escapedSearch = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = { $regex: escapedSearch, $options: 'i' };
        query.$or = [
          { orderCode: searchRegex },
          { fullName: searchRegex },
          { phone: searchRegex },
          { address: searchRegex },
          { note: searchRegex },
        ];
      }
    }

    if (totalFrom != null || totalTo != null) {
      query.totalAmount = {};
      if (totalFrom != null) query.totalAmount.$gte = totalFrom;
      if (totalTo != null) query.totalAmount.$lte = totalTo;
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    let projection: any = {};
    if (fields) {
      projection = fields.split(',').reduce((acc, field) => {
        acc[field.trim()] = 1;
        return acc;
      }, {});
    }

    const total = await this.orderModel.countDocuments(query);

    const data = await this.orderModel
      .find(query, projection)
      .populate({ path: 'userId', select: 'email avatarUrl' })
      .populate({ path: 'items.productId', select: '-description' })
      .sort(sortBy)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    const snapshotSafeOrders = data.map((order) =>
      this.toSnapshotSafeOrder(order as unknown as Record<string, any>),
    );

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: snapshotSafeOrders,
    };
  }

  async findOne(id: string, actor: OwnershipActor | null = null) {
    const order = await this.orderModel
      .findById(id)
      .populate('items.productId')
      .exec();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (actor !== null) {
      assertOwnerOrPermission({
        actor,
        ownerId: order.userId,
        permission: Permission.ORDER_MANAGE,
        targetType: 'order',
      });
    }

    return this.toSnapshotSafeOrder(order as unknown as Record<string, any>);
  }

  async findByCode(code: string, actor: OwnershipActor | null = null) {
    const order = await this.orderModel
      .findOne({ orderCode: code })
      .populate('items.productId')
      .exec();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (actor !== null) {
      assertOwnerOrPermission({
        actor,
        ownerId: order.userId,
        permission: Permission.ORDER_MANAGE,
        targetType: 'order',
      });
    }

    return this.toSnapshotSafeOrder(order as unknown as Record<string, any>);
  }

  async updateStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    actor: OwnershipActor | null = null,
  ) {
    const orderBeforeUpdate = await this.orderModel.findById(id);

    if (!orderBeforeUpdate) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const currentStatus = orderBeforeUpdate.orderStatus as OrderStatus;
    const targetStatus = dto.orderStatus;
    const allowedTargets = VALID_STAFF_TRANSITIONS[currentStatus] ?? [];

    if (!allowedTargets.includes(targetStatus)) {
      throw new BadRequestException(ORDER_STATUS_TRANSITION_NOT_ALLOWED);
    }

    const cancellationReason = dto.cancellationReason?.trim();
    if (targetStatus === OrderStatus.CANCELLED && !cancellationReason) {
      throw new BadRequestException(ORDER_CANCELLATION_REASON_REQUIRED);
    }


    const changedAt = new Date();
    const actorId = String(actor?.id ?? actor?._id ?? '');
    const actorRole = actor?.role ? String(actor.role) : undefined;
    const statusHistoryEntry = {
      fromStatus: currentStatus,
      toStatus: targetStatus,
      changedBy: actorId || undefined,
      changedByRole: actorRole,
      reason: cancellationReason,
      changedAt,
    };
    const orderEvent = {
      type: 'ORDER_STATUS_CHANGED',
      message: `Order status changed from ${currentStatus} to ${targetStatus}`,
      actorId: actorId || undefined,
      actorRole,
      metadata: {
        fromStatus: currentStatus,
        toStatus: targetStatus,
        ...(cancellationReason && { reason: cancellationReason }),
      },
      createdAt: changedAt,
    };

    const updateData: Record<string, unknown> = { orderStatus: targetStatus };

    if (targetStatus === OrderStatus.COMPLETED) {
      updateData.paymentStatus = PaymentStatus.PAID;
    }

    if (targetStatus === OrderStatus.CANCELLED) {
      updateData.paymentStatus = PaymentStatus.CANCELLED;
      updateData.cancellationReason = cancellationReason;
      updateData.cancelledBy = actorId || undefined;
      updateData.cancelledByRole = actorRole;
      updateData.cancelledAt = changedAt;
    }

    const updatedOrder = await this.orderModel.findOneAndUpdate(
      { _id: id, orderStatus: currentStatus },
      {
        $set: updateData,
        $push: {
          statusHistory: statusHistoryEntry,
          orderEvents: orderEvent,
        },
      },
      { new: true },
    );

    if (!updatedOrder) {
      throw new BadRequestException(ORDER_STATUS_TRANSITION_NOT_ALLOWED);
    }

    try {
      if (targetStatus === OrderStatus.COMPLETED) {
        await this.applyInventoryTransition(id, 'COMMITTED', 'order:updateStatus');
      }

      if (targetStatus === OrderStatus.CANCELLED) {
        await this.applyInventoryTransition(id, 'RELEASED', 'order:updateStatus');
        await this.restoreVoucherReservationIfEligible(orderBeforeUpdate, id);
      }
    } catch (error) {
      const rollbackSet: Record<string, unknown> = {
        orderStatus: currentStatus,
        paymentStatus: orderBeforeUpdate.paymentStatus,
      };
      const rollbackUnset: Record<string, number> = {};

      [
        'cancellationReason',
        'cancelledBy',
        'cancelledByRole',
        'cancelledAt',
      ].forEach((field) => {
        const value = (orderBeforeUpdate as unknown as Record<string, unknown>)[field];
        if (value === undefined || value === null) {
          rollbackUnset[field] = 1;
        } else {
          rollbackSet[field] = value;
        }
      });

      await this.orderModel.findByIdAndUpdate(id, {
        $set: rollbackSet,
        ...(Object.keys(rollbackUnset).length ? { $unset: rollbackUnset } : {}),
        $pull: {
          statusHistory: { changedAt },
          orderEvents: { type: 'ORDER_STATUS_CHANGED', createdAt: changedAt },
        },
      });

      throw error;
    }

    return updatedOrder;
  }

  async cancelOrder(
    id: string,
    actor: OwnershipActor,
    requestContext: { ip?: string; userAgent?: string } = {},
  ) {
    const order = await this.orderModel.findById(id);

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    assertOwnerOrPermission({
      actor,
      ownerId: order.userId,
      permission: Permission.ORDER_MANAGE,
      targetType: 'order',
    });

    this.assertCustomerCancellationAllowed(order);

    await this.applyInventoryTransition(id, 'RELEASED', 'order:cancelOrder');

    const cancelledOrder = await this.orderModel.findByIdAndUpdate(
      id,
      {
        orderStatus: ORDER_STATUS.CANCELLED,
        paymentStatus: PAYMENT_STATUS.CANCELLED,
      },
      { new: true },
    );

    if (!cancelledOrder) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    await this.restoreVoucherReservationIfEligible(order, id);
    await this.auditService.record({
      actorId: String(actor?.id ?? actor?._id ?? ''),
      actorRole: actor?.role,
      action: 'ORDER_CANCELLED_BY_CUSTOMER',
      targetType: 'order',
      targetId: String(cancelledOrder._id),
      reason: 'Customer cancelled an eligible order',
      metadata: {
        orderCode: cancelledOrder.orderCode,
        orderStatus: cancelledOrder.orderStatus,
        paymentStatus: cancelledOrder.paymentStatus,
      },
      ip: requestContext.ip,
      userAgent: requestContext.userAgent,
    });

    return this.toSnapshotSafeOrder(
      cancelledOrder as unknown as Record<string, any>,
    );
  }

  async getTotalRevenue(startDate: Date, endDate: Date): Promise<number> {
    const result = await this.orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          orderStatus: OrderStatus.COMPLETED,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
        },
      },
    ]);

    return result.length > 0 ? result[0].total : 0;
  }

  async getRevenueGrowth(
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date,
  ): Promise<number> {
    const currentRevenue = await this.getTotalRevenue(currentStart, currentEnd);
    const previousRevenue = await this.getTotalRevenue(
      previousStart,
      previousEnd,
    );

    if (previousRevenue === 0) return currentRevenue > 0 ? 1 : 0;

    return (currentRevenue - previousRevenue) / previousRevenue;
  }

  async getOrdersCount(startDate: Date, endDate: Date): Promise<number> {
    return this.orderModel
      .countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
        orderStatus: OrderStatus.COMPLETED,
      })
      .exec();
  }

  async getOrdersGrowth(
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date,
  ): Promise<number> {
    const currentCount = await this.getOrdersCount(currentStart, currentEnd);
    const previousCount = await this.getOrdersCount(previousStart, previousEnd);

    if (previousCount === 0) return 1;

    return (currentCount - previousCount) / previousCount;
  }

  async getSalesAndOrdersByDate(startDate: Date, endDate: Date) {
    const result = await this.orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          orderStatus: {
            $in: [
              OrderStatus.PROCESSING,
              OrderStatus.SHIPPING,
              OrderStatus.COMPLETED,
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          sales: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          sales: 1,
          orders: 1,
        },
      },
    ]);

    return result;
  }
}
