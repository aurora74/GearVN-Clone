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

import { OrderStatus } from './enums/order-status';
import { PaymentStatus } from './enums/payment-status';
import { ProductService } from 'src/product/product.service';
import { ORDER_STATUS, PAYMENT_STATUS } from 'src/config.global';

const ORDER_CANCEL_NOT_ALLOWED = 'ORDER_CANCEL_NOT_ALLOWED';

type InventoryTransitionTarget = 'RESERVED' | 'COMMITTED' | 'RELEASED';
type InventoryStatusValue = 'NONE' | 'RESERVED' | 'COMMITTED' | 'RELEASED';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly productService: ProductService,
    private readonly auditService: AuditService,
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

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = await this.orderModel.countDocuments({
      createdAt: {
        $gte: new Date(today.setHours(0, 0, 0, 0)),
        $lt: new Date(today.setHours(23, 59, 59, 999)),
      },
    });

    const orderCode = `DH${dateStr}-${(countToday + 1)
      .toString()
      .padStart(4, '0')}`;

    const { items, totalAmount, promotionAdjustments } =
      await this.buildValidatedOrderItems(dto.items);

    if (totalAmount <= 0) {
      throw this.createCheckoutError(
        'CHECKOUT_TOTAL_CHANGED',
        'Order total changed. Please review your cart and checkout again.',
      );
    }

    const orderData: Partial<Order> = {
      userId,
      orderCode,
      note,
      items,
      phone,
      address,
      fullName,
      totalAmount,
      paymentMethod: dto.paymentMethod,
      orderStatus: ORDER_STATUS.PROCESSING,
      paymentStatus: PAYMENT_STATUS.PENDING,
      // Placeholder seam for Phase 4 promotions without trusting client pricing.
      ...((promotionAdjustments.length > 0 && {
        promotionAdjustments,
      }) as Record<string, unknown>),
    };

    const createdOrder = await new this.orderModel(orderData).save();

    try {
      await this.applyInventoryTransition(
        String(createdOrder._id),
        'RESERVED',
        'order:create',
      );
    } catch (error) {
      await this.orderModel.findByIdAndDelete(createdOrder._id);
      throw error;
    }

    const hydratedOrder = await this.orderModel.findById(createdOrder._id);
    return hydratedOrder ?? createdOrder;
  }

  private createCheckoutError(
    code:
      | 'CHECKOUT_ITEM_NOT_FOUND'
      | 'CHECKOUT_ITEM_UNAVAILABLE'
      | 'CHECKOUT_STOCK_CHANGED'
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
            ...snapshotProduct,
            ...populatedProduct,
            _id: populatedProduct._id ?? snapshotProduct._id,
            slug: populatedProduct.slug ?? snapshotProduct.slug,
            name: populatedProduct.name ?? snapshotProduct.name,
            images:
              Array.isArray(populatedProduct.images) &&
              populatedProduct.images.length > 0
                ? populatedProduct.images
                : snapshotProduct.images,
            price: populatedProduct.price ?? snapshotProduct.price,
            discountPrice:
              populatedProduct.discountPrice ?? snapshotProduct.discountPrice,
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
    }>;

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
      const finalPrice = Number(product.discountPrice ?? unitPrice);

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

      const lineTotal = finalPrice * quantity;

      validatedItems.push({
        productId,
        quantity,
        productName,
        productSlug,
        productImage,
        unitPrice,
        finalPrice,
        lineTotal,
      });
    }

    const totalAmount = validatedItems.reduce(
      (sum, item) => sum + item.lineTotal,
      0,
    );

    const promotionAdjustments: Array<{
      code: string;
      amount: number;
      reason: string;
    }> = [];

    return {
      items: validatedItems,
      totalAmount,
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
      if (Types.ObjectId.isValid(search) && search.length === 24) {
        query._id = new Types.ObjectId(search);
      } else {
        query.orderCode = { $regex: search, $options: 'i' };
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

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data,
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

  async updateStatus(id: string, status: OrderStatus) {
    if (status === OrderStatus.COMPLETED) {
      await this.applyInventoryTransition(id, 'COMMITTED', 'order:updateStatus');
    }

    if (status === OrderStatus.CANCELLED) {
      await this.applyInventoryTransition(id, 'RELEASED', 'order:updateStatus');
    }

    const updateData: Partial<Order> = { orderStatus: status };

    if (status === OrderStatus.COMPLETED) {
      updateData.paymentStatus = PaymentStatus.PAID;
    }

    if (status === OrderStatus.CANCELLED) {
      updateData.paymentStatus = PaymentStatus.CANCELLED;
    }

    const updatedOrder = await this.orderModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true },
    );

    if (!updatedOrder) {
      throw new NotFoundException(`Order with ID ${id} not found`);
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
