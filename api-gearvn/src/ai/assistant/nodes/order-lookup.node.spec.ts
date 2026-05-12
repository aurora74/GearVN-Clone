import { ORDER_STATUS } from '../../../config.global';
import { orderLookupNode, OrderLookupAdapter } from './order-lookup.node';

const ownedOrders = [
  {
    id: 'order-1',
    orderCode: 'GTVN-20260509-001',
    createdAt: '2026-05-09T06:30:00.000Z',
    orderStatus: ORDER_STATUS.PROCESSING,
    paymentStatus: 'PENDING',
    totalAmount: 24_990_000,
    items: [
      {
        productId: '64f100000000000000000001',
        name: 'Laptop Gaming RTX 4060',
        quantity: 1,
      },
    ],
    phone: '0900000000',
    address: 'Private customer address',
  },
  {
    id: 'order-2',
    orderCode: 'GTVN-20260509-002',
    createdAt: '2026-05-08T08:15:00.000Z',
    orderStatus: ORDER_STATUS.SHIPPING,
    paymentStatus: 'PAID',
    totalAmount: 1_490_000,
    items: [
      {
        productId: '64f100000000000000000099',
        name: 'Keyboard RGB',
        quantity: 1,
      },
    ],
    phone: '0911111111',
    address: 'Another private customer address',
  },
];

describe('orderLookupNode', () => {
  const findMyOrders = jest.fn();
  const orderLookupAdapter = {
    findMyOrders,
  } as unknown as jest.Mocked<OrderLookupAdapter>;

  beforeEach(() => {
    jest.clearAllMocks();
    findMyOrders.mockResolvedValue({
      page: 1,
      limit: 10,
      total: ownedOrders.length,
      totalPages: 1,
      data: ownedOrders,
    });
  });

  it('CHAT-05 returns login-required metadata and Đăng nhập để xem đơn hàng without querying orders when unauthenticated', async () => {
    const result = await orderLookupNode(
      {
        userText: 'Kiem tra don hang cua toi',
        authenticatedUserId: null,
        intentPlan: { needsOrderLookup: true },
      },
      { orderLookupAdapter },
    );

    expect(findMyOrders).not.toHaveBeenCalled();
    expect(result.text).toContain('Đăng nhập để xem đơn hàng');
    expect(result.metadata).toMatchObject({
      loginRequired: true,
      primaryAction: {
        label: 'Đăng nhập để xem đơn hàng',
        action: 'LOGIN',
      },
    });
  });

  it('CHAT-05 calls findMyOrders with authenticated user ID and valid PROCESSING status filter', async () => {
    await orderLookupNode(
      {
        userText: 'Xem don dang xu ly',
        authenticatedUserId: 'user-authenticated-1',
        intentPlan: {
          needsOrderLookup: true,
          orderStatus: ORDER_STATUS.PROCESSING,
        },
      },
      { orderLookupAdapter },
    );

    expect(findMyOrders).toHaveBeenCalledWith('user-authenticated-1', {
      orderStatus: 'PROCESSING',
    });
  });

  it('CHAT-05 ignores prompt-supplied customer IDs, phone numbers, and emails for ownership', async () => {
    await orderLookupNode(
      {
        userText:
          'Xem don cua customerId=user-other phone 0988888888 email other@example.test',
        authenticatedUserId: 'user-authenticated-1',
        parsedEntities: {
          customerId: 'user-other',
          phone: '0988888888',
          email: 'other@example.test',
        },
        intentPlan: { needsOrderLookup: true },
      },
      { orderLookupAdapter },
    );

    expect(findMyOrders).toHaveBeenCalledWith(
      'user-authenticated-1',
      expect.not.objectContaining({
        customerId: 'user-other',
        phone: '0988888888',
        email: 'other@example.test',
      }),
    );
  });

  it('CHAT-05 maps only PROCESSING, SHIPPING, COMPLETED, and CANCELLED filters and asks clarification for invalid filters', async () => {
    for (const orderStatus of [
      ORDER_STATUS.PROCESSING,
      ORDER_STATUS.SHIPPING,
      ORDER_STATUS.COMPLETED,
      ORDER_STATUS.CANCELLED,
    ]) {
      await orderLookupNode(
        {
          userText: `Loc don ${orderStatus}`,
          authenticatedUserId: 'user-authenticated-1',
          intentPlan: { needsOrderLookup: true, orderStatus },
        },
        { orderLookupAdapter },
      );
    }

    expect(findMyOrders).toHaveBeenCalledWith('user-authenticated-1', {
      orderStatus: 'PROCESSING',
    });
    expect(findMyOrders).toHaveBeenCalledWith('user-authenticated-1', {
      orderStatus: 'SHIPPING',
    });
    expect(findMyOrders).toHaveBeenCalledWith('user-authenticated-1', {
      orderStatus: 'COMPLETED',
    });
    expect(findMyOrders).toHaveBeenCalledWith('user-authenticated-1', {
      orderStatus: 'CANCELLED',
    });

    jest.clearAllMocks();
    const invalidResult = await orderLookupNode(
      {
        userText: 'Xem don bi hoan tien',
        authenticatedUserId: 'user-authenticated-1',
        intentPlan: { needsOrderLookup: true, orderStatus: 'REFUNDED' },
      },
      { orderLookupAdapter },
    );

    expect(findMyOrders).not.toHaveBeenCalled();
    expect(invalidResult.metadata.needsClarification).toBe(true);
    expect(invalidResult.text).toContain('trạng thái đơn hàng');
  });

  it('CHAT-05 returns safe order cards with orderId, orderCode, createdAt, status, paymentStatus, total, items, and detailHref while omitting phone and address', async () => {
    const result = await orderLookupNode(
      {
        userText: 'Xem don hang cua toi',
        authenticatedUserId: 'user-authenticated-1',
        intentPlan: { needsOrderLookup: true },
      },
      { orderLookupAdapter },
    );

    expect(result.metadata.orderCards[0]).toMatchObject({
      orderId: 'order-1',
      orderCode: 'GTVN-20260509-001',
      createdAt: '2026-05-09T06:30:00.000Z',
      status: 'PROCESSING',
      paymentStatus: 'PENDING',
      total: 24_990_000,
      items: [
        expect.objectContaining({
          name: 'Laptop Gaming RTX 4060',
          quantity: 1,
        }),
      ],
      detailHref: expect.stringContaining('/orders/'),
    });
    expect(result.metadata.orderCards[0]).not.toHaveProperty('orderStatus');
    expect(result.metadata.orderCards[0]).not.toHaveProperty('totalAmount');

    const serialized = JSON.stringify(result.metadata.orderCards);
    expect(serialized).not.toContain('phone');
    expect(serialized).not.toContain('address');
    expect(serialized).not.toContain('0900000000');
    expect(serialized).not.toContain('Private customer address');
  });

  it('CHAT-05 normalizes malformed object-valued order fields before metadata reaches React', async () => {
    findMyOrders.mockResolvedValueOnce({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
      data: [
        {
          id: {},
          orderCode: {},
          createdAt: {},
          orderStatus: {},
          paymentStatus: {},
          totalAmount: {},
          items: [
            null,
            'bad-item',
            {
              productId: {},
              name: {},
              quantity: {},
            },
          ],
        },
      ],
    });

    const result = await orderLookupNode(
      {
        userText: 'Đơn hàng của tôi',
        authenticatedUserId: 'user-authenticated-1',
        intentPlan: { needsOrderLookup: true },
      },
      { orderLookupAdapter },
    );

    expect(result.metadata.orderCards[0]).toEqual({
      orderId: '',
      status: 'UNKNOWN',
      items: [],
      detailHref: '/orders/',
    });
    expect(JSON.stringify(result.metadata.orderCards)).not.toContain('[object Object]');
  });
});
