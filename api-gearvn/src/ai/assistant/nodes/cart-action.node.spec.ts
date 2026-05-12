import {
  AssistantActionAdapter,
  cartActionNode,
} from './cart-action.node';

describe('cartActionNode', () => {
  const roomId = 'room-client-customer-1';
  const customerId = 'customer-1';
  const product = {
    id: 'product-1',
    slug: 'laptop-gaming-a',
    name: 'Laptop Gaming A',
    price: 25000000,
    stock: 4,
  };

  const makeAdapter = (): jest.Mocked<AssistantActionAdapter> =>
    ({
      findProductSnapshot: jest.fn().mockResolvedValue(product),
      createDraft: jest.fn(async (draft) => ({
        ...draft,
        draftId: 'draft-cart-1',
        roomId,
        customerId,
        status: 'pending',
        confirmedByBackend: false,
        expiresAt: new Date('2026-05-09T08:00:00.000Z'),
      })),
      mutateCart: jest.fn(),
      confirmAction: jest.fn(),
      createOrder: jest.fn(),
      createPayment: jest.fn(),
      decrementInventory: jest.fn(),
      reserveVoucher: jest.fn(),
    }) as any;

  it.each([
    ['add request', 'CART_ADD', 'Thêm vào giỏ'],
    ['remove request', 'CART_REMOVE', 'Xóa khỏi giỏ'],
    ['quantity request', 'CART_SET_QUANTITY', 'Cập nhật số lượng'],
  ])(
    'creates a pending %s draft without mutating customer cart state',
    async (_label, action, displayText) => {
      const adapter = makeAdapter();

      const result = await cartActionNode(
        {
          roomId,
          customerId,
          intent: action,
          productId: product.id,
          quantity: action === 'CART_REMOVE' ? 0 : 2,
        },
        adapter,
      );

      expect(adapter.findProductSnapshot).toHaveBeenCalledWith(product.id);
      expect(adapter.createDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId,
          customerId,
          action,
          displayText,
          product: expect.objectContaining({ id: product.id }),
          quantity: action === 'CART_REMOVE' ? 0 : 2,
          confirmedByBackend: false,
        }),
      );
      expect(result).toMatchObject({
        type: 'assistant_action_draft',
        draft: {
          draftId: 'draft-cart-1',
          roomId,
          action,
          displayText,
          confirmedByBackend: false,
        },
      });
      expect(result).not.toHaveProperty('confirmedPayload');
      expect(adapter.mutateCart).not.toHaveBeenCalled();
      expect(adapter.confirmAction).not.toHaveBeenCalled();
      expect(adapter.createOrder).not.toHaveBeenCalled();
      expect(adapter.createPayment).not.toHaveBeenCalled();
      expect(adapter.decrementInventory).not.toHaveBeenCalled();
      expect(adapter.reserveVoucher).not.toHaveBeenCalled();
    },
  );

  it('asks for clarification when product or quantity cannot be resolved', async () => {
    const adapter = makeAdapter();
    adapter.findProductSnapshot.mockResolvedValueOnce(null);

    const unresolvedProduct = await cartActionNode(
      {
        roomId,
        customerId,
        intent: 'CART_ADD',
        productId: 'unknown-product',
        quantity: 1,
      },
      adapter,
    );

    const invalidQuantity = await cartActionNode(
      {
        roomId,
        customerId,
        intent: 'CART_SET_QUANTITY',
        productId: product.id,
        quantity: 0,
      },
      adapter,
    );

    expect(unresolvedProduct).toMatchObject({
      type: 'clarification',
      reason: 'unresolved_product',
    });
    expect(invalidQuantity).toMatchObject({
      type: 'clarification',
      reason: 'invalid_quantity',
    });
    expect(adapter.createDraft).not.toHaveBeenCalled();
    expect(adapter.mutateCart).not.toHaveBeenCalled();
  });
});
