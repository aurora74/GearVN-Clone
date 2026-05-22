import { BadRequestException } from '@nestjs/common';

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
  'src/order/order.schema',
  () => ({
    Order: class Order {},
  }),
  { virtual: true },
);

jest.mock(
  'src/order/order.service',
  () => ({
    OrderService: class OrderService {},
  }),
  { virtual: true },
);

import { ORDER_STATUS, PAYMENT_STATUS } from 'src/config.global';

import { buildSecureHash } from './helper/build-secure-hash';
import { sortObject } from './helper/sort-object';
import { PaymentService } from './payment.service';

const secret = 'test-secret';

const baseOrder = (overrides: Record<string, any> = {}) => ({
  _id: '64f0c2a1b2c3d4e5f6071829',
  userId: 'user-1',
  orderStatus: ORDER_STATUS.PROCESSING,
  paymentStatus: PAYMENT_STATUS.PENDING,
  totalAmount: 1200,
  ...overrides,
});

const signedVnpayQuery = (overrides: Record<string, any> = {}) => {
  const query = {
    vnp_TxnRef: '64f0c2a1b2c3d4e5f6071829_1700000000000_abcd1234',
    vnp_ResponseCode: '00',
    vnp_Amount: '120000',
    vnp_TransactionNo: '14123456',
    ...overrides,
  };

  return {
    ...query,
    vnp_SecureHash: buildSecureHash(secret, sortObject(query)),
  };
};

const createService = (initialOrder: Record<string, any>) => {
  let order = { ...initialOrder };

  const matches = (filter: Record<string, any>) => {
    if (filter._id && String(filter._id) !== String(order._id)) return false;
    if (filter.paymentStatus) {
      const condition = filter.paymentStatus;
      if (condition.$ne && order.paymentStatus === condition.$ne) return false;
      if (!condition.$ne && order.paymentStatus !== condition) return false;
    }
    return true;
  };

  const applySet = (update: Record<string, any>) => {
    order = {
      ...order,
      ...Object.fromEntries(
        Object.entries(update.$set ?? {}).filter(([, value]) => value !== undefined),
      ),
    };
  };

  const orderModel = {
    findById: jest.fn(() => ({
      lean: jest.fn().mockResolvedValue({ ...order }),
    })),
    findByIdAndUpdate: jest.fn(async (id: string, update: Record<string, any>) => {
      if (String(id) !== String(order._id)) return null;
      order = { ...order, ...update };
      return { ...order };
    }),
    findOneAndUpdate: jest.fn(async (filter: Record<string, any>, update: Record<string, any>) => {
      if (!matches(filter)) return null;
      applySet(update);
      return { ...order };
    }),
  };

  const orderService = {
    findOne: jest.fn(async () => ({ ...order })),
    applyInventoryTransition: jest.fn(async () => undefined),
  };

  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        'vnpay.url': 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
        'vnpay.tmnCode': 'TESTTMN',
        'vnpay.returnUrl': 'https://shop.example/payment/vnpay/return',
        'vnpay.hashSecret': secret,
      };
      return values[key];
    }),
  };

  const service = new PaymentService(config as any, orderService as any, orderModel as any);

  return {
    service,
    orderModel,
    orderService,
    getOrder: () => ({ ...order }),
  };
};

describe('PaymentService VNPay reconciliation', () => {
  it('keeps a failed return pending, then reconciles a later retry success', async () => {
    const { service, orderService, getOrder } = createService(baseOrder());

    const failed = await service.reconcileVnpayReturn(
      signedVnpayQuery({
        vnp_TxnRef: '64f0c2a1b2c3d4e5f6071829_1700000000000_cancel',
        vnp_ResponseCode: '24',
        vnp_TransactionNo: '14000001',
      }),
    );

    expect(failed).toMatchObject({
      status: 'failed',
      orderId: '64f0c2a1b2c3d4e5f6071829',
      vnpResponseCode: '24',
      replay: false,
    });
    expect(getOrder()).toMatchObject({
      paymentProvider: 'VNPAY',
      paymentResponseCode: '24',
      paymentAmount: 1200,
      paymentSignatureValid: true,
      paymentStatus: PAYMENT_STATUS.PENDING,
    });
    expect(getOrder().paymentReconciledAt).toBeUndefined();
    expect(orderService.applyInventoryTransition).not.toHaveBeenCalled();

    const success = await service.reconcileVnpayReturn(
      signedVnpayQuery({
        vnp_TxnRef: '64f0c2a1b2c3d4e5f6071829_1700000001000_success',
        vnp_ResponseCode: '00',
        vnp_TransactionNo: '14000002',
      }),
    );

    expect(success).toMatchObject({
      status: 'success',
      orderId: '64f0c2a1b2c3d4e5f6071829',
      vnpResponseCode: '00',
      replay: false,
    });
    expect(getOrder().paymentStatus).toBe(PAYMENT_STATUS.PAID);
    expect(getOrder().paymentReconciledAt).toBeInstanceOf(Date);
    expect(orderService.applyInventoryTransition).toHaveBeenCalledTimes(1);
    expect(orderService.applyInventoryTransition).toHaveBeenCalledWith(
      '64f0c2a1b2c3d4e5f6071829',
      'COMMITTED',
      'payment:vnpayReturn',
    );
  });

  it('returns persisted success for duplicate successful returns without reapplying inventory', async () => {
    const { service, orderModel, orderService } = createService(
      baseOrder({
        paymentStatus: PAYMENT_STATUS.PAID,
        paymentReconciledAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );

    await expect(service.reconcileVnpayReturn(signedVnpayQuery())).resolves.toMatchObject({
      status: 'success',
      orderId: '64f0c2a1b2c3d4e5f6071829',
      replay: true,
    });
    expect(orderModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(orderService.applyInventoryTransition).not.toHaveBeenCalled();
  });

  it('does not downgrade a paid order when VNPay later sends a failed return', async () => {
    const { service, orderService, getOrder } = createService(
      baseOrder({
        paymentStatus: PAYMENT_STATUS.PAID,
        paymentReconciledAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );

    await expect(
      service.reconcileVnpayReturn(signedVnpayQuery({ vnp_ResponseCode: '24' })),
    ).resolves.toMatchObject({
      status: 'success',
      replay: true,
    });
    expect(getOrder().paymentStatus).toBe(PAYMENT_STATUS.PAID);
    expect(orderService.applyInventoryTransition).not.toHaveBeenCalled();
  });

  it('generates a unique VNPay transaction reference for each payment URL attempt', async () => {
    const { service } = createService(baseOrder());

    const firstUrl = await service.createPaymentUrl(
      { orderId: '64f0c2a1b2c3d4e5f6071829', orderInfo: 'Pay order' },
      '127.0.0.1',
      { id: 'user-1' },
    );
    const secondUrl = await service.createPaymentUrl(
      { orderId: '64f0c2a1b2c3d4e5f6071829', orderInfo: 'Pay order' },
      '127.0.0.1',
      { id: 'user-1' },
    );

    const firstRef = new URL(firstUrl).searchParams.get('vnp_TxnRef');
    const secondRef = new URL(secondUrl).searchParams.get('vnp_TxnRef');

    expect(firstRef).toMatch(/^64f0c2a1b2c3d4e5f6071829_\d+_[a-f0-9]{8}$/);
    expect(secondRef).toMatch(/^64f0c2a1b2c3d4e5f6071829_\d+_[a-f0-9]{8}$/);
    expect(firstRef).not.toBe(secondRef);
    expect(firstRef).not.toBe('64f0c2a1b2c3d4e5f6071829');
  });

  it('supports legacy VNPay transaction references that are just the order id', async () => {
    const { service, orderModel } = createService(baseOrder());

    await expect(
      service.reconcileVnpayReturn(
        signedVnpayQuery({
          vnp_TxnRef: '64f0c2a1b2c3d4e5f6071829',
          vnp_ResponseCode: '00',
        }),
      ),
    ).resolves.toMatchObject({
      status: 'success',
      orderId: '64f0c2a1b2c3d4e5f6071829',
      replay: false,
    });
    expect(orderModel.findById).toHaveBeenCalledWith('64f0c2a1b2c3d4e5f6071829');
  });

  it('marks invalid signatures against the parsed order id and rejects', async () => {
    const { service, orderModel } = createService(baseOrder());

    await expect(
      service.reconcileVnpayReturn({
        ...signedVnpayQuery({
          vnp_TxnRef: '64f0c2a1b2c3d4e5f6071829_1700000000000_bad',
        }),
        vnp_SecureHash: 'invalid',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      '64f0c2a1b2c3d4e5f6071829',
      expect.objectContaining({
        paymentProvider: 'VNPAY',
        paymentSignatureValid: false,
      }),
    );
  });
});
