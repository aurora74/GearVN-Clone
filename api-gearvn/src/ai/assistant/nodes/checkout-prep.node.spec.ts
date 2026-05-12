import {
  checkoutPrepNode,
  VoucherAdapter,
} from './checkout-prep.node';

describe('checkoutPrepNode', () => {
  const roomId = 'room-client-customer-1';
  const customerId = 'customer-1';

  const makeVoucherAdapter = (): jest.Mocked<VoucherAdapter> =>
    ({
      listPublic: jest.fn().mockResolvedValue([
        {
          code: 'SAVE10',
          label: 'Giảm 10%',
          minimumOrderValue: 1000000,
        },
      ]),
      validatePublic: jest.fn().mockResolvedValue({
        code: 'SAVE10',
        valid: true,
        discountAmount: 150000,
      }),
      createDraft: jest.fn(async (draft) => ({
        ...draft,
        draftId: 'draft-checkout-1',
        status: 'pending',
        confirmedByBackend: false,
        expiresAt: new Date('2026-05-09T08:00:00.000Z'),
      })),
      createOrder: jest.fn(),
      createPayment: jest.fn(),
      decrementInventory: jest.fn(),
      reserveVoucher: jest.fn(),
    }) as any;

  it('requires missing checkout fields before creating a redirect draft', async () => {
    const adapter = makeVoucherAdapter();

    const result = await checkoutPrepNode(
      {
        roomId,
        customerId,
        subtotal: 25000000,
        checkout: {
          name: 'Nguyen Van A',
          phone: '',
          address: 'Quan 1, TP HCM',
        },
      },
      adapter,
    );

    expect(result).toMatchObject({
      type: 'clarification',
      missingFields: ['phone'],
    });
    expect(adapter.createDraft).not.toHaveBeenCalled();
    expect(adapter.createOrder).not.toHaveBeenCalled();
    expect(adapter.createPayment).not.toHaveBeenCalled();
    expect(adapter.decrementInventory).not.toHaveBeenCalled();
    expect(adapter.reserveVoucher).not.toHaveBeenCalled();
  });

  it('checks voucher availability and returns checkout review before redirect draft', async () => {
    const adapter = makeVoucherAdapter();

    const result = await checkoutPrepNode(
      {
        roomId,
        customerId,
        subtotal: 25000000,
        selectedVoucherCode: 'SAVE10',
        checkout: {
          name: 'Nguyen Van A',
          phone: '0909123456',
          address: 'Quan 1, TP HCM',
        },
      },
      adapter,
    );

    expect(adapter.listPublic).toHaveBeenCalledWith({ customerId, subtotal: 25000000 });
    expect(adapter.validatePublic).toHaveBeenCalledWith({
      code: 'SAVE10',
      customerId,
      subtotal: 25000000,
    });
    expect(result).toMatchObject({
      type: 'checkout_review',
      metadata: {
        checkoutReview: {
          name: 'Nguyen Van A',
          phoneMasked: '090****456',
          addressPreview: 'Quan 1, TP HCM',
          actions: ['Đúng rồi', 'Chỉnh sửa'],
        },
        advisory: true,
        redirectPath: '/cart?step=payment',
      },
    });
    expect(adapter.createDraft).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('confirmedPayload');
    expect(adapter.createOrder).not.toHaveBeenCalled();
    expect(adapter.createPayment).not.toHaveBeenCalled();
    expect(adapter.decrementInventory).not.toHaveBeenCalled();
    expect(adapter.reserveVoucher).not.toHaveBeenCalled();
  });

  it('creates checkout redirect draft only after the review is accepted', async () => {
    const adapter = makeVoucherAdapter();

    const result = await checkoutPrepNode(
      {
        roomId,
        customerId,
        subtotal: 25000000,
        reviewAccepted: true,
        checkout: {
          name: 'Nguyen Van A',
          phone: '0909123456',
          address: 'Quan 1, TP HCM',
        },
      },
      adapter,
    );

    expect(adapter.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId,
        customerId,
        action: 'CHECKOUT_REDIRECT',
        displayText: 'Đi tới thanh toán',
        redirectPath: '/cart?step=payment',
        checkout: {
          name: 'Nguyen Van A',
          phone: '0909123456',
          address: 'Quan 1, TP HCM',
        },
        confirmedByBackend: false,
      }),
    );
    expect(result).toMatchObject({
      type: 'assistant_action_draft',
      draft: {
        draftId: 'draft-checkout-1',
        action: 'CHECKOUT_REDIRECT',
        redirectPath: '/cart?step=payment',
        confirmedByBackend: false,
      },
    });
    expect(adapter.createOrder).not.toHaveBeenCalled();
    expect(adapter.createPayment).not.toHaveBeenCalled();
    expect(adapter.decrementInventory).not.toHaveBeenCalled();
    expect(adapter.reserveVoucher).not.toHaveBeenCalled();
  });

  it('keeps voucher validation advisory before checkout authority applies it', async () => {
    const adapter = makeVoucherAdapter();

    const result = await checkoutPrepNode(
      {
        roomId,
        customerId,
        subtotal: 25000000,
        selectedVoucherCode: 'SAVE10',
        checkout: {
          name: 'Nguyen Van A',
          phone: '0909123456',
          address: 'Quan 1, TP HCM',
        },
      },
      adapter,
    );

    expect(adapter.validatePublic).toHaveBeenCalledWith({
      code: 'SAVE10',
      customerId,
      subtotal: 25000000,
    });
    expect(result).toMatchObject({
      type: 'checkout_review',
      metadata: {
        advisory: true,
        voucherAdvisoryText:
          'Kết quả kiểm tra voucher trong chat chỉ mang tính tham khảo; bước thanh toán vẫn là nơi xác thực cuối cùng.',
      },
    });
    expect(adapter.createDraft).not.toHaveBeenCalled();
    expect(adapter.reserveVoucher).not.toHaveBeenCalled();
    expect(adapter.createOrder).not.toHaveBeenCalled();
    expect(adapter.createPayment).not.toHaveBeenCalled();
  });
});
