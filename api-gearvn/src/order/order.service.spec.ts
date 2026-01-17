import { BadRequestException, ConflictException } from '@nestjs/common';

jest.mock(
  'src/auth/policy/permissions',
  () => ({
    Permission: {
      ORDER_MANAGE: 'ORDER_MANAGE',
    },
  }),
  { virtual: true },
);

jest.mock(
  'src/auth/policy/ownership',
  () => ({
    assertOwnerOrPermission: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  'src/config.global',
  () => ({
    ORDER_STATUS: {
      PROCESSING: 'PROCESSING',
      SHIPPING: 'SHIPPING',
      COMPLETED: 'COMPLETED',
      CANCELLED: 'CANCELLED',
    },
    PAYMENT_STATUS: {
      PENDING: 'PENDING',
      PAID: 'PAID',
      CANCELLED: 'CANCELLED',
    },
  }),
  { virtual: true },
);

jest.mock(
  'src/product/product.service',
  () => ({
    ProductService: class ProductService {},
  }),
  { virtual: true },
);

jest.mock(
  'src/event/event.service',
  () => ({
    EventService: class EventService {},
  }),
  { virtual: true },
);

jest.mock(
  'src/voucher/voucher.service',
  () => ({
    VoucherService: class VoucherService {},
  }),
  { virtual: true },
);

jest.mock(
  'src/audit/audit.service',
  () => ({
    AuditService: class AuditService {},
  }),
  { virtual: true },
);

import { PaymentMethod } from './enums/payment-method';
import { OrderStatus } from './enums/order-status';
import { OrderService } from './order.service';

const buildCheckoutDto = (overrides: Record<string, any> = {}) => ({
  fullName: 'Nguyen Van A',
  phone: '0901234567',
  address: '123 Nguyen Hue, Quan 1',
  paymentMethod: PaymentMethod.COD,
  items: [{ productId: 'product-1', quantity: 1 }],
  ...overrides,
});

const buildProduct = (overrides: Record<string, any> = {}) => ({
  _id: 'product-1',
  name: 'Laptop Gaming',
  slug: 'laptop-gaming',
  images: ['https://cdn.example.com/laptop.png'],
  price: 25000000,
  discountPrice: 20000000,
  event: 'flash-sale',
  stock: 10,
  status: 'active',
  ...overrides,
});

describe('OrderService checkout validation', () => {
  let orderModel: any;
  let productService: {
    findOne: jest.Mock;
    decreaseStock: jest.Mock;
    increaseStock: jest.Mock;
    increaseSoldQuantity: jest.Mock;
    decreaseSoldQuantity: jest.Mock;
  };
  let eventService: { findActiveFlashSaleByTag: jest.Mock };
  let voucherService: {
    reserveForOrder: jest.Mock;
    restoreReservation: jest.Mock;
  };
  let auditService: { record: jest.Mock };
  let service: OrderService;

  beforeEach(() => {
    orderModel = jest.fn().mockImplementation((data) => ({
      save: jest.fn().mockResolvedValue({
        _id: 'order-id',
        ...data,
      }),
    }));

    orderModel.findOne = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    });
    orderModel.countDocuments = jest.fn().mockResolvedValue(0);
    orderModel.findById = jest.fn().mockResolvedValue(null);
    orderModel.findByIdAndUpdate = jest.fn();
    orderModel.findByIdAndDelete = jest.fn().mockResolvedValue({ acknowledged: true });
    orderModel.findOneAndUpdate = jest.fn();

    productService = {
      findOne: jest.fn(),
      decreaseStock: jest.fn().mockResolvedValue({ _id: 'product-1', stock: 8 }),
      increaseStock: jest.fn().mockResolvedValue({ acknowledged: true }),
      increaseSoldQuantity: jest.fn().mockResolvedValue({ acknowledged: true }),
      decreaseSoldQuantity: jest.fn().mockResolvedValue({ acknowledged: true }),
    };

    eventService = {
      findActiveFlashSaleByTag: jest.fn().mockResolvedValue({
        tag: 'flash-sale',
        name: 'Tet Flash Sale',
        status: 'active',
      }),
    };

    voucherService = {
      reserveForOrder: jest.fn(),
      restoreReservation: jest.fn().mockResolvedValue({ _id: 'voucher-1' }),
    };

    auditService = {
      record: jest.fn().mockResolvedValue({ _id: 'audit-id' }),
    };

    service = new OrderService(
      orderModel,
      productService as any,
      auditService as any,
      eventService as any,
      voucherService as any,
    );
  });

  const mockReservationFlow = () => {
    orderModel.findById
      .mockResolvedValueOnce({
        _id: 'order-id',
        inventoryStatus: 'NONE',
        items: [{ productId: 'product-1', quantity: 1 }],
      })
      .mockResolvedValueOnce({
        _id: 'order-id',
        inventoryStatus: 'RESERVED',
      });

    orderModel.findOneAndUpdate.mockResolvedValueOnce({
      _id: 'order-id',
      inventoryStatus: 'NONE',
      items: [{ productId: 'product-1', quantity: 1 }],
    });
  };

  it('creates normalized order items and a server-computed total amount', async () => {
    productService.findOne.mockResolvedValue(buildProduct());
    mockReservationFlow();

    await service.create(
      buildCheckoutDto({
        note: 'Giao gio hanh chinh',
        items: [{ productId: 'product-1', quantity: 2 }],
      }),
      'customer-1',
    );

    expect(orderModel).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'customer-1',
        subtotalAmount: 40000000,
        productDiscountAmount: 10000000,
        voucherDiscountAmount: 0,
        totalAmount: 40000000,
        items: [
          expect.objectContaining({
            productId: 'product-1',
            productName: 'Laptop Gaming',
            productSlug: 'laptop-gaming',
            productImage: 'https://cdn.example.com/laptop.png',
            unitPrice: 25000000,
            finalPrice: 20000000,
            lineTotal: 40000000,
            eventTag: 'flash-sale',
            eventName: 'Tet Flash Sale',
            promotionStatus: 'active',
            originalPrice: 25000000,
            quantity: 2,
          }),
        ],
        promotionAdjustments: [
          expect.objectContaining({
            type: 'flash_sale',
            eventTag: 'flash-sale',
            eventName: 'Tet Flash Sale',
            amount: 10000000,
          }),
        ],
      }),
    );
  });

  it('retries with the next order code when MongoDB reports an orderCode duplicate', async () => {
    let saveAttempts = 0;
    orderModel.mockImplementation((data) => ({
      save: jest.fn().mockImplementation(async () => {
        saveAttempts += 1;

        if (saveAttempts === 1) {
          throw { code: 11000, keyPattern: { orderCode: 1 }, keyValue: { orderCode: data.orderCode } };
        }

        return { _id: 'order-id', ...data };
      }),
    }));
    productService.findOne.mockResolvedValue(buildProduct());
    mockReservationFlow();

    await service.create(buildCheckoutDto(), 'customer-1');

    expect(orderModel).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ orderCode: expect.stringMatching(/-0001$/) }),
    );
    expect(orderModel).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ orderCode: expect.stringMatching(/-0002$/) }),
    );
  });
  it('does not apply an active promo price to an ineligible product', async () => {
    productService.findOne.mockResolvedValue(buildProduct({ isPublished: false }));
    mockReservationFlow();

    await service.create(
      buildCheckoutDto({ items: [{ productId: 'product-1', quantity: 1 }] }),
      'customer-1',
    );

    expect(orderModel).toHaveBeenCalledWith(
      expect.objectContaining({
        totalAmount: 25000000,
        productDiscountAmount: 0,
        items: [
          expect.objectContaining({
            finalPrice: 25000000,
            promotionStatus: 'ineligible',
          }),
        ],
      }),
    );
  });

  it('rejects expired flash-sale cart prices before creating an order', async () => {
    productService.findOne.mockResolvedValue(buildProduct());
    eventService.findActiveFlashSaleByTag.mockResolvedValue(null);

    await expect(
      service.create(
        buildCheckoutDto({
          items: [
            { productId: 'product-1', quantity: 1, clientFinalPrice: 20000000 },
          ],
        }),
        'customer-1',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        detail: expect.objectContaining({
          code: 'CHECKOUT_PRICE_CHANGED',
          items: [
            expect.objectContaining({
              productId: 'product-1',
              previousFinalPrice: 20000000,
              currentFinalPrice: 25000000,
              promotionStatus: 'inactive',
              promotionEligible: true,
            }),
          ],
        }),
      }),
    });
    expect(orderModel).not.toHaveBeenCalled();
  });

  it('rejects invalid voucher codes without creating an order', async () => {
    productService.findOne.mockResolvedValue(buildProduct());
    voucherService.reserveForOrder.mockRejectedValue(
      new BadRequestException({
        message: 'Voucher cannot be applied',
        detail: { code: 'VOUCHER_INVALID' },
      }),
    );

    await expect(
      service.create(buildCheckoutDto({ voucherCode: 'BADCODE' }), 'customer-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        detail: expect.objectContaining({ code: 'VOUCHER_INVALID' }),
      }),
    });
    expect(orderModel).not.toHaveBeenCalled();
  });

  it('rejects vouchers below the minimum order value', async () => {
    productService.findOne.mockResolvedValue(buildProduct());
    voucherService.reserveForOrder.mockRejectedValue(
      new BadRequestException({
        message: 'Voucher cannot be applied',
        detail: { code: 'VOUCHER_MINIMUM_NOT_MET' },
      }),
    );

    await expect(
      service.create(buildCheckoutDto({ voucherCode: 'MIN500' }), 'customer-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        detail: expect.objectContaining({ code: 'VOUCHER_MINIMUM_NOT_MET' }),
      }),
    });
    expect(orderModel).not.toHaveBeenCalled();
  });

  it('rejects vouchers when the usage cap is exhausted', async () => {
    productService.findOne.mockResolvedValue(buildProduct());
    voucherService.reserveForOrder.mockRejectedValue(
      new BadRequestException({
        message: 'Voucher cannot be applied',
        detail: { code: 'VOUCHER_USAGE_LIMIT' },
      }),
    );

    await expect(
      service.create(buildCheckoutDto({ voucherCode: 'USEDUP' }), 'customer-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        detail: expect.objectContaining({ code: 'VOUCHER_USAGE_LIMIT' }),
      }),
    });
    expect(orderModel).not.toHaveBeenCalled();
  });

  it('stores successful voucher reservation snapshots on the order', async () => {
    const reservedAt = new Date('2026-05-02T03:00:00Z');
    productService.findOne.mockResolvedValue(buildProduct());
    voucherService.reserveForOrder.mockResolvedValue({
      voucherId: 'voucher-1',
      code: 'SAVE10',
      discountType: 'percentage',
      discountValue: 10,
      minimumOrderValue: 1000000,
      maximumDiscountAmount: 3000000,
      discountAmount: 2000000,
      reservedUsage: true,
      reservedAt,
    });
    mockReservationFlow();

    await service.create(
      buildCheckoutDto({ voucherCode: 'SAVE10', items: [{ productId: 'product-1', quantity: 1 }] }),
      'customer-1',
    );

    expect(voucherService.reserveForOrder).toHaveBeenCalledWith('SAVE10', 20000000);
    expect(orderModel).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotalAmount: 20000000,
        productDiscountAmount: 5000000,
        voucherDiscountAmount: 2000000,
        totalAmount: 18000000,
        voucherSnapshot: expect.objectContaining({
          voucherId: 'voucher-1',
          code: 'SAVE10',
          reservedUsage: true,
          reservedAt,
        }),
        promotionAdjustments: expect.arrayContaining([
          expect.objectContaining({ type: 'voucher', voucherCode: 'SAVE10', amount: 2000000 }),
        ]),
      }),
    );
  });

  it('restores voucher reservations when customer cancellation is allowed', async () => {
    orderModel.findById.mockResolvedValue({
      _id: 'order-id',
      orderCode: 'DH20260101-0001',
      userId: 'customer-1',
      orderStatus: 'PROCESSING',
      paymentStatus: 'PENDING',
      inventoryStatus: 'RESERVED',
      voucherSnapshot: { voucherId: 'voucher-1', reservedUsage: true },
      items: [],
    });
    orderModel.findOneAndUpdate.mockResolvedValueOnce({
      _id: 'order-id',
      inventoryStatus: 'RESERVED',
      items: [],
    });
    orderModel.findByIdAndUpdate
      .mockResolvedValueOnce({
        _id: 'order-id',
        orderCode: 'DH20260101-0001',
        userId: 'customer-1',
        orderStatus: 'CANCELLED',
        paymentStatus: 'CANCELLED',
        voucherSnapshot: { voucherId: 'voucher-1', reservedUsage: true },
        items: [],
        toObject: () => ({
          _id: 'order-id',
          orderCode: 'DH20260101-0001',
          userId: 'customer-1',
          orderStatus: 'CANCELLED',
          paymentStatus: 'CANCELLED',
          voucherSnapshot: { voucherId: 'voucher-1', reservedUsage: true },
          items: [],
        }),
      })
      .mockResolvedValueOnce({ _id: 'order-id' });

    await service.cancelOrder('order-id', { id: 'customer-1' } as any);

    expect(voucherService.restoreReservation).toHaveBeenCalledWith('voucher-1');
    expect(orderModel.findByIdAndUpdate).toHaveBeenLastCalledWith(
      'order-id',
      { $set: { 'voucherSnapshot.restoredAt': expect.any(Date) } },
      { new: true },
    );
  });

  it('does not restore voucher reservations for completed or paid orders', async () => {
    orderModel.findById.mockResolvedValue({
      _id: 'order-id',
      userId: 'customer-1',
      orderStatus: 'COMPLETED',
      paymentStatus: 'PAID',
      voucherSnapshot: { voucherId: 'voucher-1', reservedUsage: true },
    });

    await expect(
      service.cancelOrder('order-id', { id: 'customer-1' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(voucherService.restoreReservation).not.toHaveBeenCalled();
  });

  it('returns recoverable stock-change checkout errors', async () => {
    productService.findOne.mockResolvedValue(buildProduct({ stock: 1 }));

    try {
      await service.create(
        buildCheckoutDto({ items: [{ productId: 'product-1', quantity: 2 }] }),
        'customer-2',
      );
      fail('Expected create() to throw BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        detail?: { code?: string };
      };
      expect(response.detail?.code).toBe('CHECKOUT_STOCK_CHANGED');
    }
  });

  it('prevents duplicate reserve transition for the same order', async () => {
    orderModel.findById.mockResolvedValue({
      _id: 'order-id',
      inventoryStatus: 'NONE',
      items: [{ productId: 'product-1', quantity: 1 }],
    });

    orderModel.findOneAndUpdate
      .mockResolvedValueOnce({
        _id: 'order-id',
        inventoryStatus: 'NONE',
        items: [{ productId: 'product-1', quantity: 1 }],
      })
      .mockResolvedValueOnce(null);

    await service.applyInventoryTransition('order-id', 'RESERVED', 'test');
    await service.applyInventoryTransition('order-id', 'RESERVED', 'test');

    expect(productService.decreaseStock).toHaveBeenCalledTimes(1);
  });

  it('fails cleanly when guarded stock decrement cannot reserve inventory', async () => {
    orderModel.findById.mockResolvedValue({
      _id: 'order-id',
      inventoryStatus: 'NONE',
      items: [{ productId: 'product-1', quantity: 2 }],
    });

    orderModel.findOneAndUpdate.mockResolvedValueOnce({
      _id: 'order-id',
      inventoryStatus: 'NONE',
      items: [{ productId: 'product-1', quantity: 2 }],
    });

    productService.decreaseStock.mockResolvedValueOnce(null);

    await expect(
      service.applyInventoryTransition('order-id', 'RESERVED', 'test'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith('order-id', {
      $set: { inventoryStatus: 'NONE' },
      $unset: { inventoryReservedAt: 1 },
    });
  });

  it('allows customer cancellation only for processing + pending orders', async () => {
    orderModel.findById.mockResolvedValue({
      _id: 'order-id',
      orderCode: 'DH20260101-0001',
      userId: 'customer-1',
      orderStatus: 'PROCESSING',
      paymentStatus: 'PENDING',
      inventoryStatus: 'RESERVED',
      items: [],
    });

    orderModel.findOneAndUpdate.mockResolvedValueOnce({
      _id: 'order-id',
      inventoryStatus: 'RESERVED',
      items: [],
    });

    orderModel.findByIdAndUpdate.mockResolvedValue({
      _id: 'order-id',
      orderCode: 'DH20260101-0001',
      userId: 'customer-1',
      orderStatus: 'CANCELLED',
      paymentStatus: 'CANCELLED',
      items: [],
      toObject: () => ({
        _id: 'order-id',
        orderCode: 'DH20260101-0001',
        userId: 'customer-1',
        orderStatus: 'CANCELLED',
        paymentStatus: 'CANCELLED',
        items: [],
      }),
    });

    await service.cancelOrder('order-id', { id: 'customer-1' } as any);

    expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'order-id',
      {
        orderStatus: 'CANCELLED',
        paymentStatus: 'CANCELLED',
      },
      { new: true },
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORDER_CANCELLED_BY_CUSTOMER',
        targetType: 'order',
      }),
    );
  });

  it('denies cancellation outside the allowed customer matrix', async () => {
    orderModel.findById.mockResolvedValue({
      _id: 'order-id',
      userId: 'customer-1',
      orderStatus: 'SHIPPING',
      paymentStatus: 'PENDING',
    });

    await expect(
      service.cancelOrder('order-id', { id: 'customer-1' } as any),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(orderModel.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });
  it('allows PROCESSING -> SHIPPING and appends status history and an event', async () => {
    orderModel.findById.mockResolvedValue({
      _id: 'order-id',
      orderStatus: OrderStatus.PROCESSING,
      paymentStatus: 'PENDING',
      items: [],
    });
    orderModel.findOneAndUpdate.mockResolvedValue({ _id: 'order-id' });

    await service.updateStatus(
      'order-id',
      { orderStatus: OrderStatus.SHIPPING },
      { id: 'staff-1', role: 'SALES_OPERATIONS_STAFF' } as any,
    );

    expect(orderModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'order-id', orderStatus: OrderStatus.PROCESSING },
      expect.objectContaining({
        $set: { orderStatus: OrderStatus.SHIPPING },
        $push: expect.objectContaining({
          statusHistory: expect.objectContaining({
            fromStatus: OrderStatus.PROCESSING,
            toStatus: OrderStatus.SHIPPING,
            changedBy: 'staff-1',
            changedByRole: 'SALES_OPERATIONS_STAFF',
          }),
          orderEvents: expect.objectContaining({
            type: 'ORDER_STATUS_CHANGED',
          }),
        }),
      }),
      { new: true },
    );
    expect(productService.decreaseStock).not.toHaveBeenCalled();
  });

  it('allows PROCESSING -> CANCELLED only with a reason', async () => {
    orderModel.findById.mockResolvedValue({
      _id: 'order-id',
      orderCode: 'DH20260101-0001',
      orderStatus: OrderStatus.PROCESSING,
      paymentStatus: 'PENDING',
      inventoryStatus: 'RESERVED',
      voucherSnapshot: { voucherId: 'voucher-1', reservedUsage: true },
      items: [],
    });
    orderModel.findOneAndUpdate
      .mockResolvedValueOnce({ _id: 'order-id', orderStatus: OrderStatus.CANCELLED })
      .mockResolvedValueOnce({
        _id: 'order-id',
        inventoryStatus: 'RESERVED',
        items: [],
      });

    await service.updateStatus(
      'order-id',
      { orderStatus: OrderStatus.CANCELLED, cancellationReason: 'Khach yeu cau huy' },
      { id: 'staff-1', role: 'SALES_OPERATIONS_STAFF' } as any,
    );

    expect(orderModel.findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      { _id: 'order-id', orderStatus: OrderStatus.PROCESSING },
      expect.objectContaining({
        $set: expect.objectContaining({
          orderStatus: OrderStatus.CANCELLED,
          paymentStatus: 'CANCELLED',
          cancellationReason: 'Khach yeu cau huy',
          cancelledBy: 'staff-1',
          cancelledByRole: 'SALES_OPERATIONS_STAFF',
          cancelledAt: expect.any(Date),
        }),
        $push: expect.objectContaining({
          statusHistory: expect.objectContaining({
            reason: 'Khach yeu cau huy',
          }),
        }),
      }),
      { new: true },
    );
    expect(voucherService.restoreReservation).toHaveBeenCalledWith('voucher-1');
  });

  it('allows SHIPPING -> COMPLETED and commits inventory', async () => {
    orderModel.findById.mockResolvedValue({
      _id: 'order-id',
      orderStatus: OrderStatus.SHIPPING,
      paymentStatus: 'PENDING',
      inventoryStatus: 'RESERVED',
      items: [{ productId: 'product-1', quantity: 1 }],
    });
    orderModel.findOneAndUpdate
      .mockResolvedValueOnce({ _id: 'order-id', orderStatus: OrderStatus.COMPLETED })
      .mockResolvedValueOnce({
        _id: 'order-id',
        inventoryStatus: 'RESERVED',
        inventoryReservedAt: new Date('2026-05-02T00:00:00Z'),
        items: [{ productId: 'product-1', quantity: 1 }],
      });

    await service.updateStatus('order-id', { orderStatus: OrderStatus.COMPLETED });

    expect(productService.increaseSoldQuantity).toHaveBeenCalledWith('product-1', 1);
    expect(orderModel.findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      { _id: 'order-id', orderStatus: OrderStatus.SHIPPING },
      expect.objectContaining({
        $set: expect.objectContaining({
          orderStatus: OrderStatus.COMPLETED,
          paymentStatus: 'PAID',
        }),
      }),
      { new: true },
    );
  });

  it('rejects invalid COMPLETED -> SHIPPING before inventory side effects', async () => {
    orderModel.findById.mockResolvedValue({
      _id: 'order-id',
      orderStatus: OrderStatus.COMPLETED,
      paymentStatus: 'PAID',
      items: [],
    });

    await expect(
      service.updateStatus('order-id', { orderStatus: OrderStatus.SHIPPING }),
    ).rejects.toMatchObject({ message: 'ORDER_STATUS_TRANSITION_NOT_ALLOWED' });

    expect(orderModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(orderModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects CANCELLED without a reason before inventory side effects', async () => {
    orderModel.findById.mockResolvedValue({
      _id: 'order-id',
      orderStatus: OrderStatus.PROCESSING,
      paymentStatus: 'PENDING',
      items: [],
    });

    await expect(
      service.updateStatus('order-id', { orderStatus: OrderStatus.CANCELLED }),
    ).rejects.toMatchObject({ message: 'ORDER_CANCELLATION_REASON_REQUIRED' });

    expect(orderModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(orderModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });
  const mockFindOrdersQuery = (data: any[] = []) => {
    const queryChain: any = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(data),
    };
    orderModel.find = jest.fn().mockReturnValue(queryChain);
    orderModel.countDocuments.mockResolvedValue(data.length);
    return queryChain;
  };

  it('searches staff orders by order code, customer fields, and note keywords', async () => {
    mockFindOrdersQuery();

    await service.findOrders({ search: 'gaming note' });

    expect(orderModel.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [
          { orderCode: { $regex: 'gaming note', $options: 'i' } },
          { fullName: { $regex: 'gaming note', $options: 'i' } },
          { phone: { $regex: 'gaming note', $options: 'i' } },
          { address: { $regex: 'gaming note', $options: 'i' } },
          { note: { $regex: 'gaming note', $options: 'i' } },
        ],
      }),
    );
  });

  it('searches staff orders by ObjectId when the search term is a valid id', async () => {
    const orderId = '64f1a8b0f5c2d6a1b2c3d4e5';
    mockFindOrdersQuery();

    await service.findOrders({ search: orderId });

    expect(orderModel.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ _id: expect.any(Object) }),
    );
    expect(orderModel.countDocuments.mock.calls[0][0].$or).toBeUndefined();
  });

  it('keeps snapshot item fields in staff order detail', async () => {
    const order = {
      _id: 'order-id',
      userId: 'customer-1',
      orderStatus: OrderStatus.PROCESSING,
      paymentStatus: 'PENDING',
      promotionAdjustments: [{ type: 'flash_sale', amount: 5000000 }],
      voucherSnapshot: { voucherId: 'voucher-1', code: 'SAVE10' },
      statusHistory: [],
      orderEvents: [],
      cancellationReason: 'Khach huy',
      items: [
        {
          productId: {
            _id: 'product-1',
            name: 'Current Product Name',
            slug: 'current-product',
            images: ['https://cdn.example.com/current.png'],
            price: 30000000,
            discountPrice: 28000000,
          },
          productName: 'Laptop Gaming Snapshot',
          productSlug: 'laptop-gaming-snapshot',
          productImage: 'https://cdn.example.com/snapshot.png',
          unitPrice: 25000000,
          finalPrice: 20000000,
          lineTotal: 40000000,
          eventTag: 'flash-sale',
          eventName: 'Tet Flash Sale',
          promotionStatus: 'active',
          quantity: 2,
        },
      ],
      toObject() {
        return this;
      },
    };
    orderModel.findById.mockReturnValue({
      populate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(order) }),
    });

    const result = await service.findOne('order-id', null);

    expect(result).toEqual(
      expect.objectContaining({
        promotionAdjustments: [{ type: 'flash_sale', amount: 5000000 }],
        voucherSnapshot: { voucherId: 'voucher-1', code: 'SAVE10' },
        statusHistory: [],
        orderEvents: [],
        cancellationReason: 'Khach huy',
        items: [
          expect.objectContaining({
            productName: 'Laptop Gaming Snapshot',
            finalPrice: 20000000,
            lineTotal: 40000000,
            productId: expect.objectContaining({
              name: 'Laptop Gaming Snapshot',
              price: 25000000,
              discountPrice: 20000000,
            }),
          }),
        ],
      }),
    );
  });

  it('keeps processing and shipping order volume out of completed revenue trend totals', async () => {
    orderModel.aggregate = jest.fn().mockResolvedValue([
      { date: '2026-05-01', sales: 1000000, orders: 3 },
    ]);

    await service.getSalesAndOrdersByDate(
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-03T00:00:00.000Z'),
    );

    const pipeline = orderModel.aggregate.mock.calls[0][0];
    expect(JSON.stringify(pipeline)).toContain(OrderStatus.PROCESSING);
    expect(JSON.stringify(pipeline)).toContain(OrderStatus.SHIPPING);
    expect(JSON.stringify(pipeline)).toContain(OrderStatus.COMPLETED);
    expect(JSON.stringify(pipeline)).toContain(
      `\"$eq\":[\"$orderStatus\",\"${OrderStatus.COMPLETED}\"]`,
    );
  });

  it('groups completed revenue by payment method only', async () => {
    orderModel.aggregate = jest.fn().mockResolvedValue([
      { paymentMethod: PaymentMethod.COD, revenue: 1000000, orders: 1 },
    ]);

    const result = await service.getCompletedRevenueByPaymentMethod(
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-03T00:00:00.000Z'),
    );

    expect(result).toEqual([
      { paymentMethod: PaymentMethod.COD, revenue: 1000000, orders: 1 },
    ]);
    expect(orderModel.aggregate.mock.calls[0][0][0].$match).toEqual(
      expect.objectContaining({ orderStatus: OrderStatus.COMPLETED }),
    );
  });

  it('returns no order growth when both periods have zero completed orders', async () => {
    orderModel.countDocuments = jest
      .fn()
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(0) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(0) });

    await expect(
      service.getOrdersGrowth(
        new Date('2026-05-01T00:00:00.000Z'),
        new Date('2026-05-03T23:59:59.999Z'),
        new Date('2026-04-28T00:00:00.000Z'),
        new Date('2026-04-30T23:59:59.999Z'),
      ),
    ).resolves.toBe(0);
  });

  it('groups top selling products from completed orders in the selected period', async () => {
    orderModel.aggregate = jest.fn().mockResolvedValue([
      { _id: 'product-1', name: 'Laptop', images: ['image.png'], soldQuantity: 4 },
    ]);

    const result = await service.getTopSellingProducts(
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-03T23:59:59.999Z'),
      5,
    );

    expect(result).toEqual([
      { _id: 'product-1', name: 'Laptop', images: ['image.png'], soldQuantity: 4 },
    ]);
    expect(orderModel.aggregate.mock.calls[0][0][0].$match).toEqual(
      expect.objectContaining({ orderStatus: OrderStatus.COMPLETED }),
    );
    expect(JSON.stringify(orderModel.aggregate.mock.calls[0][0])).toContain(
      'createdAt',
    );
  });
});
