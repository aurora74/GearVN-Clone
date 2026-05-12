import { AssistantActionConfirmationService } from './assistant-action-confirmation.service';

describe('AssistantActionConfirmationService', () => {
  const now = new Date('2026-05-09T07:45:00.000Z');
  const roomId = 'room-client-customer-1';
  const customerId = 'customer-1';
  const draftId = 'draft-1';
  const confirmEventName = 'assistant-confirm-action';

  const baseDraft = {
    draftId,
    roomId,
    customerId,
    action: 'CART_ADD',
    displayText: 'Thêm vào giỏ',
    productId: 'product-1',
    quantity: 1,
    expiresAt: new Date('2026-05-09T08:00:00.000Z'),
    checkout: {
      name: 'Nguyen Van A',
      phone: '0909123456',
      address: 'Quan 1, TP HCM',
    },
    voucherCode: 'SAVE10',
  };

  const product = {
    id: 'product-1',
    name: 'Laptop Gaming A',
    stock: 4,
    price: 25000000,
  };

  const makeAdapters = () => ({
    draftStore: {
      findPendingDraft: jest.fn().mockResolvedValue(baseDraft),
      markConfirmed: jest.fn(),
    },
    chatRoom: {
      assertCustomerOwnsRoom: jest.fn().mockResolvedValue(true),
    },
    productCatalog: {
      findSnapshotById: jest.fn().mockResolvedValue(product),
    },
    voucher: {
      validatePublic: jest.fn().mockResolvedValue({
        code: 'SAVE10',
        valid: true,
        discountAmount: 150000,
      }),
      reserveForOrder: jest.fn(),
    },
    cart: {
      addItem: jest.fn().mockResolvedValue({
        productId: product.id,
        quantity: 1,
      }),
      removeItem: jest.fn(),
      setQuantity: jest.fn(),
    },
    order: {
      create: jest.fn(),
    },
    payment: {
      createPayment: jest.fn(),
    },
    inventory: {
      decrement: jest.fn(),
    },
    clock: {
      now: jest.fn(() => now),
    },
  });

  const makeService = (adapters = makeAdapters()) =>
    new AssistantActionConfirmationService(adapters as any);

  const rejectionCases: Array<{
    label: string;
    draftPatch: Record<string, any>;
    expectedReason: string;
    ownsRoom?: boolean;
    productSnapshot?: typeof product | null;
  }> = [
    {
      label: 'wrong draft owner',
      draftPatch: { customerId: 'other-customer' },
      expectedReason: 'draft_owner_mismatch',
    },
    {
      label: 'wrong room owner',
      draftPatch: {},
      expectedReason: 'room_owner_mismatch',
      ownsRoom: false,
    },
    {
      label: 'expired draft',
      draftPatch: { expiresAt: new Date('2026-05-09T07:44:59.000Z') },
      expectedReason: 'draft_expired',
    },
    {
      label: 'invalid product',
      draftPatch: { productId: 'missing-product' },
      expectedReason: 'invalid_product',
      productSnapshot: null,
    },
    {
      label: 'invalid quantity',
      draftPatch: { quantity: 0 },
      expectedReason: 'invalid_quantity',
    },
    {
      label: 'invalid voucher',
      draftPatch: { voucherCode: 'BADCODE' },
      expectedReason: 'invalid_voucher',
    },
    {
      label: 'missing checkout fields',
      draftPatch: {
        action: 'CHECKOUT_REDIRECT',
        checkout: { name: 'Nguyen Van A', phone: '', address: 'Quan 1, TP HCM' },
      },
      expectedReason: 'checkout_fields_incomplete',
    },
  ];

  it.each(rejectionCases)(
    'rejects $label before returning confirmed payload',
    async ({ draftPatch, expectedReason, ownsRoom = true, productSnapshot = product }) => {
      const adapters = makeAdapters();
      adapters.draftStore.findPendingDraft.mockResolvedValueOnce({
        ...baseDraft,
        ...draftPatch,
      });
      adapters.chatRoom.assertCustomerOwnsRoom.mockResolvedValueOnce(ownsRoom);
      adapters.productCatalog.findSnapshotById.mockResolvedValueOnce(productSnapshot);
      if (draftPatch?.voucherCode === 'BADCODE') {
        adapters.voucher.validatePublic.mockResolvedValueOnce({
          code: 'BADCODE',
          valid: false,
          reason: 'not_found',
        });
      }
      const service = makeService(adapters);

      await expect(
        service.confirmAction({
          eventName: confirmEventName,
          draftId,
          roomId,
          customerId,
        }),
      ).rejects.toMatchObject({ reason: expectedReason });

      expect(adapters.draftStore.markConfirmed).not.toHaveBeenCalled();
      expect(adapters.cart.addItem).not.toHaveBeenCalled();
      expect(adapters.order.create).not.toHaveBeenCalled();
      expect(adapters.payment.createPayment).not.toHaveBeenCalled();
      expect(adapters.inventory.decrement).not.toHaveBeenCalled();
      expect(adapters.voucher.reserveForOrder).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['CART_ADD', 'Thêm vào giỏ', { cartItem: { productId: product.id, quantity: 1 } }],
    ['CART_REMOVE', 'Xóa khỏi giỏ', { removedProductId: product.id }],
    ['CART_SET_QUANTITY', 'Cập nhật số lượng', { quantity: 1 }],
    ['APPLY_VOUCHER', 'Áp dụng voucher', { voucher: { code: 'SAVE10' } }],
    [
      'CHECKOUT_REDIRECT',
      'Đi tới thanh toán',
      {
        redirectPath: '/cart?step=payment',
        checkout: baseDraft.checkout,
      },
    ],
  ])(
    'returns backend-confirmed %s result without creating orders, payments, inventory, or voucher reservations',
    async (action, displayText, expectedPayload) => {
      const adapters = makeAdapters();
      adapters.draftStore.findPendingDraft.mockResolvedValueOnce({
        ...baseDraft,
        action,
        displayText,
      });
      const service = makeService(adapters);

      const result = await service.confirmAction({
        eventName: confirmEventName,
        draftId,
        roomId,
        customerId,
      });

      expect(result).toMatchObject({
        confirmedByBackend: true,
        draftId,
        roomId,
        action,
        displayText,
        confirmedPayload: expectedPayload,
      });
      expect(adapters.draftStore.markConfirmed).toHaveBeenCalledWith(draftId, {
        confirmedByBackend: true,
        confirmedAt: now,
        confirmedPayload: expect.objectContaining(expectedPayload),
      });
      expect(adapters.order.create).not.toHaveBeenCalled();
      expect(adapters.payment.createPayment).not.toHaveBeenCalled();
      expect(adapters.inventory.decrement).not.toHaveBeenCalled();
      expect(adapters.voucher.reserveForOrder).not.toHaveBeenCalled();
    },
  );
});
