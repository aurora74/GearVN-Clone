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
  'src/audit/audit.service',
  () => ({
    AuditService: class AuditService {},
  }),
  { virtual: true },
);

import { PaymentMethod } from './enums/payment-method';
import { OrderService } from './order.service';

describe('OrderService checkout validation', () => {
  let orderModel: any;
  let productService: {
    findOne: jest.Mock;
    decreaseStock: jest.Mock;
    increaseStock: jest.Mock;
    increaseSoldQuantity: jest.Mock;
    decreaseSoldQuantity: jest.Mock;
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

    auditService = {
      record: jest.fn().mockResolvedValue({ _id: 'audit-id' }),
    };

    service = new OrderService(
      orderModel,
      productService as any,
      auditService as any,
    );
  });

  it('creates normalized order items and a server-computed total amount', async () => {
    productService.findOne.mockResolvedValue({
      _id: 'product-1',
      name: 'Laptop Gaming',
      slug: 'laptop-gaming',
      images: ['https://cdn.example.com/laptop.png'],
      price: 25000000,
      discountPrice: 20000000,
      stock: 10,
    });

    orderModel.findById
      .mockResolvedValueOnce({
        _id: 'order-id',
        inventoryStatus: 'NONE',
        items: [{ productId: 'product-1', quantity: 2 }],
      })
      .mockResolvedValueOnce({
        _id: 'order-id',
        inventoryStatus: 'RESERVED',
      });

    orderModel.findOneAndUpdate.mockResolvedValueOnce({
      _id: 'order-id',
      inventoryStatus: 'NONE',
      items: [{ productId: 'product-1', quantity: 2 }],
    });

    await service.create(
      {
        fullName: 'Nguyen Van A',
        phone: '0901234567',
        address: '123 Nguyen Hue, Quan 1',
        note: 'Giao gio hanh chinh',
        paymentMethod: PaymentMethod.COD,
        items: [{ productId: 'product-1', quantity: 2 }],
      },
      'customer-1',
    );

    expect(orderModel).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'customer-1',
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
            quantity: 2,
          }),
        ],
      }),
    );
  });

  it('returns recoverable stock-change checkout errors', async () => {
    productService.findOne.mockResolvedValue({
      _id: 'product-2',
      name: 'Chuot khong day',
      slug: 'chuot-khong-day',
      images: ['https://cdn.example.com/mouse.png'],
      price: 900000,
      discountPrice: 800000,
      stock: 1,
    });

    try {
      await service.create(
        {
          fullName: 'Tran Thi B',
          phone: '0912345678',
          address: '456 Dien Bien Phu, Binh Thanh',
          paymentMethod: PaymentMethod.COD,
          items: [{ productId: 'product-2', quantity: 2 }],
        },
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
});
