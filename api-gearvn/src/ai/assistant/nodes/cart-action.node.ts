export {
  AssistantActionAdapter,
  type AssistantActionDraft,
  type AssistantCartAction,
  type AssistantProductSnapshot,
} from '../adapters/assistant-action.adapter';

import {
  AssistantActionAdapter,
  AssistantCartAction,
} from '../adapters/assistant-action.adapter';

interface CartActionState {
  roomId: string;
  customerId: string;
  intent: AssistantCartAction | string;
  productId?: string;
  quantity?: number;
}

const CART_ACTION_DISPLAY: Record<AssistantCartAction, string> = {
  CART_ADD: 'Thêm vào giỏ',
  CART_REMOVE: 'Xóa khỏi giỏ',
  CART_SET_QUANTITY: 'Cập nhật số lượng',
};

export async function cartActionNode(
  state: CartActionState,
  adapter: AssistantActionAdapter,
) {
  const action = normalizeCartAction(state.intent);
  if (!action || !state.productId) {
    return { type: 'clarification', reason: 'unresolved_product' };
  }

  const product = await adapter.findProductSnapshot(state.productId);
  if (!product) {
    return { type: 'clarification', reason: 'unresolved_product' };
  }

  if (!isValidQuantity(action, state.quantity, product.stock)) {
    return { type: 'clarification', reason: 'invalid_quantity' };
  }

  const draft = await adapter.createDraft({
    roomId: state.roomId,
    customerId: state.customerId,
    action,
    displayText: CART_ACTION_DISPLAY[action],
    product,
    productId: product.id,
    quantity: state.quantity,
    confirmedByBackend: false,
  });

  return {
    type: 'assistant_action_draft',
    draft,
  };
}

function normalizeCartAction(intent: string): AssistantCartAction | null {
  if (
    intent === 'CART_ADD' ||
    intent === 'CART_REMOVE' ||
    intent === 'CART_SET_QUANTITY'
  ) {
    return intent;
  }
  return null;
}

function isValidQuantity(
  action: AssistantCartAction,
  quantity: number | undefined,
  stock?: number,
): boolean {
  if (action === 'CART_REMOVE') return quantity === 0;
  if (!Number.isInteger(quantity) || Number(quantity) <= 0) return false;
  if (typeof stock === 'number' && stock >= 0) return Number(quantity) <= stock;
  return true;
}
