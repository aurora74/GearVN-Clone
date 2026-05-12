export interface AssistantActionConfirmationAdapters {
  draftStore: {
    findPendingDraft(draftId: string): Promise<any>;
    markConfirmed(draftId: string, payload: Record<string, unknown>): Promise<unknown>;
  };
  chatRoom: {
    assertCustomerOwnsRoom(customerId: string, roomId: string): Promise<boolean>;
  };
  productCatalog: {
    findSnapshotById(productId: string): Promise<any>;
  };
  voucher: {
    validatePublic(params: {
      code: string;
      customerId?: string;
      subtotal: number;
    }): Promise<any>;
    reserveForOrder?: (...args: unknown[]) => Promise<unknown>;
  };
  cart: {
    addItem(params: { customerId: string; productId: string; quantity: number }): Promise<any>;
    removeItem(params: { customerId: string; productId: string }): Promise<any>;
    setQuantity(params: {
      customerId: string;
      productId: string;
      quantity: number;
    }): Promise<any>;
  };
  order?: { create?: (...args: unknown[]) => Promise<unknown> };
  payment?: { createPayment?: (...args: unknown[]) => Promise<unknown> };
  inventory?: { decrement?: (...args: unknown[]) => Promise<unknown> };
  clock?: { now(): Date };
}

export interface AssistantActionConfirmationInput {
  eventName: string;
  draftId: string;
  roomId: string;
  customerId: string;
}

export class AssistantActionConfirmationError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
  }
}

export class AssistantActionConfirmationService {
  constructor(private readonly adapters: AssistantActionConfirmationAdapters) {}

  async confirmAction(input: AssistantActionConfirmationInput) {
    if (input.eventName !== 'assistant-confirm-action') {
      throw new AssistantActionConfirmationError('invalid_confirmation_event');
    }

    const draft = await this.adapters.draftStore.findPendingDraft(input.draftId);
    if (!draft) throw new AssistantActionConfirmationError('draft_not_found');
    if (draft.customerId !== input.customerId) {
      throw new AssistantActionConfirmationError('draft_owner_mismatch');
    }
    if (draft.roomId !== input.roomId) {
      throw new AssistantActionConfirmationError('room_mismatch');
    }

    const ownsRoom = await this.adapters.chatRoom.assertCustomerOwnsRoom(
      input.customerId,
      input.roomId,
    );
    if (!ownsRoom) throw new AssistantActionConfirmationError('room_owner_mismatch');

    const now = this.adapters.clock?.now() ?? new Date();
    if (new Date(draft.expiresAt).getTime() <= now.getTime()) {
      throw new AssistantActionConfirmationError('draft_expired');
    }

    const product = await this.validateProductIfNeeded(draft);
    await this.validateVoucherIfNeeded(draft);
    this.validateCheckoutIfNeeded(draft);

    const confirmedPayload = await this.buildConfirmedPayload(
      draft,
      input.customerId,
      product,
    );

    const confirmation = {
      confirmedByBackend: true,
      draftId: input.draftId,
      roomId: input.roomId,
      action: draft.action,
      displayText: draft.displayText,
      confirmedPayload,
    };

    await this.adapters.draftStore.markConfirmed(input.draftId, {
      confirmedByBackend: true,
      confirmedAt: now,
      confirmedPayload,
    });

    return confirmation;
  }

  private async validateProductIfNeeded(draft: any) {
    if (!isProductAction(draft.action)) return null;
    const product = await this.adapters.productCatalog.findSnapshotById(draft.productId);
    if (!product) throw new AssistantActionConfirmationError('invalid_product');
    if (!Number.isInteger(draft.quantity) || draft.quantity <= 0) {
      throw new AssistantActionConfirmationError('invalid_quantity');
    }
    if (typeof product.stock === 'number' && draft.quantity > product.stock) {
      throw new AssistantActionConfirmationError('invalid_quantity');
    }
    return product;
  }

  private async validateVoucherIfNeeded(draft: any) {
    if (!draft.voucherCode) return;
    const subtotal = Number(draft.subtotal ?? draft.product?.price ?? 0);
    const result = await this.adapters.voucher.validatePublic({
      code: draft.voucherCode,
      customerId: draft.customerId,
      subtotal,
    });
    if (result?.valid === false) {
      throw new AssistantActionConfirmationError('invalid_voucher');
    }
  }

  private validateCheckoutIfNeeded(draft: any) {
    if (draft.action !== 'CHECKOUT_REDIRECT') return;
    if (
      !draft.checkout?.name?.trim() ||
      !draft.checkout?.phone?.trim() ||
      !draft.checkout?.address?.trim()
    ) {
      throw new AssistantActionConfirmationError('checkout_fields_incomplete');
    }
  }

  private async buildConfirmedPayload(draft: any, customerId: string, product: any) {
    if (draft.action === 'CART_ADD') {
      const cartItem = await this.adapters.cart.addItem({
        customerId,
        productId: product.id,
        quantity: draft.quantity,
      });
      return { cartItem };
    }
    if (draft.action === 'CART_REMOVE') {
      await this.adapters.cart.removeItem({ customerId, productId: draft.productId });
      return { removedProductId: draft.productId };
    }
    if (draft.action === 'CART_SET_QUANTITY') {
      await this.adapters.cart.setQuantity({
        customerId,
        productId: draft.productId,
        quantity: draft.quantity,
      });
      return { quantity: draft.quantity };
    }
    if (draft.action === 'APPLY_VOUCHER') {
      return { voucher: { code: draft.voucherCode } };
    }
    if (draft.action === 'CHECKOUT_REDIRECT') {
      return {
        redirectPath: '/cart?step=payment',
        checkout: draft.checkout,
      };
    }
    throw new AssistantActionConfirmationError('unsupported_action');
  }
}

function isProductAction(action: string): boolean {
  return (
    action === 'CART_ADD' ||
    action === 'CART_REMOVE' ||
    action === 'CART_SET_QUANTITY'
  );
}
