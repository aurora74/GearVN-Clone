import { END, START, StateGraph } from '@langchain/langgraph';

import { AssistantIntent } from '../assistant.types';
import {
  AssistantResponse,
  ShoppingAssistantState,
  ShoppingAssistantStateType,
  ShoppingAssistantStateUpdate,
} from '../shopping-assistant.state';
import {
  AssistantNodeResponse,
  mergeAssistantResponses,
} from '../nodes/merge-response.node';
import { cartActionNode } from '../nodes/cart-action.node';
import { checkoutPrepNode } from '../nodes/checkout-prep.node';
import { orderLookupNode } from '../nodes/order-lookup.node';
import { OrderToolsService } from '../tools/order-tools.service';

type OrderConfig = {
  configurable?: {
    handlers?: {
      cartAction?: (state: ShoppingAssistantStateType) => Promise<any>;
      checkoutPrep?: (state: ShoppingAssistantStateType) => Promise<any>;
      orderLookup?: (state: ShoppingAssistantStateType) => Promise<any>;
    };
    catalogAdapter?: any;
    actionAdapter?: any;
    voucherAdapter?: any;
    orderLookupAdapter?: any;
    orderToolsService?: OrderToolsService;
  };
};

async function orderCartActionNode(
  state: ShoppingAssistantStateType,
  config?: OrderConfig,
): Promise<ShoppingAssistantStateUpdate> {
  const service = config?.configurable?.orderToolsService;
  if (service) {
    const resolved = await service.resolveProductReference(state);
    const product = resolved.data;
    const action = normalizeCartAction(
      asString(state.intentPlan?.cartAction) ??
        asString(state.parsedEntities?.cartAction) ??
        'CART_ADD',
    );
    const requestedQuantity = asPositiveInteger(state.parsedEntities?.quantity);
    const hasQuantity = hasQuantityValue(state.parsedEntities?.quantity);
    if (hasQuantity && requestedQuantity === undefined && action !== 'CART_REMOVE') {
      const result = {
        data: { type: 'clarification', reason: 'invalid_quantity' },
        toolCall: {
          toolName: 'create_cart_action_draft',
          subgraph: 'order' as const,
          status: 'skipped' as const,
          outputSummary: 'invalid_quantity',
        },
      };
      return responseUpdate(
        'cart_action',
        result.data,
        state,
        AssistantIntent.CART_ACTION,
        [resolved.toolCall, result.toolCall],
      );
    }

    const quantity =
      action === 'CART_ADD'
        ? requestedQuantity ?? 1
        : action === 'CART_REMOVE'
          ? 0
          : requestedQuantity;

    if (action === 'CART_SET_QUANTITY' && quantity === undefined) {
      const result = {
        data: { type: 'clarification', reason: 'missing_quantity' },
        toolCall: {
          toolName: 'create_cart_action_draft',
          subgraph: 'order' as const,
          status: 'skipped' as const,
          outputSummary: 'missing_quantity',
        },
      };
      return responseUpdate(
        'cart_action',
        result.data,
        state,
        AssistantIntent.CART_ACTION,
        [resolved.toolCall, result.toolCall],
      );
    }

    const result = product
      ? await service.createCartActionDraft(state, product, quantity, action)
      : {
          data: { type: 'clarification', reason: 'unresolved_product' },
          toolCall: {
            toolName: 'create_cart_action_draft',
            subgraph: 'order' as const,
            status: 'skipped' as const,
            outputSummary: 'unresolved_product',
          },
        };
    return responseUpdate(
      'cart_action',
      result.data,
      state,
      AssistantIntent.CART_ACTION,
      [resolved.toolCall, result.toolCall],
    );
  }

  const actionInput = await buildCartActionInput(state, config);
  const result =
    (await config?.configurable?.handlers?.cartAction?.(state)) ??
    (await cartActionNode(actionInput, config?.configurable?.actionAdapter));
  return responseUpdate('cart_action', result, state, AssistantIntent.CART_ACTION);
}

async function orderCheckoutPrepNode(
  state: ShoppingAssistantStateType,
  config?: OrderConfig,
): Promise<ShoppingAssistantStateUpdate> {
  const service = config?.configurable?.orderToolsService;
  if (service) {
    if (isVoucherOnlyAdvisoryRequest(state)) {
      const voucherAdvisory = await service.validateVoucherAdvisory(state);
      return responseUpdate(
        'voucher_advisory',
        {
          intent: AssistantIntent.CHECKOUT_PREP,
          nodeName: 'voucher_advisory',
          text: voucherAdvisory.text,
          metadata: {
            voucherAdvisory,
            advisory: voucherAdvisory.advisory,
          },
        },
        state,
        AssistantIntent.CHECKOUT_PREP,
        [
          {
            toolName: 'validate_voucher_advisory',
            subgraph: 'order',
            status: 'success',
            outputSummary: voucherAdvisory.advisory ? 'advisory' : 'skipped',
          },
        ],
      );
    }

    const review = await service.prepareCheckoutReview(state);
    const voucherAdvisory = await service.validateVoucherAdvisory(state);
    return responseUpdate(
      'checkout_prep',
      {
        ...review,
        metadata: {
          ...review.metadata,
          voucherAdvisory,
          advisory: voucherAdvisory.advisory,
        },
      },
      state,
      AssistantIntent.CHECKOUT_PREP,
      [
        {
          toolName: 'prepare_checkout_review',
          subgraph: 'order',
          status: 'success',
          outputSummary: 'checkoutReview',
        },
        {
          toolName: 'validate_voucher_advisory',
          subgraph: 'order',
          status: 'success',
          outputSummary: voucherAdvisory.advisory ? 'advisory' : 'skipped',
        },
      ],
    );
  }

  const result =
    (await config?.configurable?.handlers?.checkoutPrep?.(state)) ??
    (await checkoutPrepNode(
      buildCheckoutInput(state),
      config?.configurable?.voucherAdapter,
    ));
  return responseUpdate(
    'checkout_prep',
    result,
    state,
    AssistantIntent.CHECKOUT_PREP,
  );
}

async function orderLookupGraphNode(
  state: ShoppingAssistantStateType,
  config?: OrderConfig,
): Promise<ShoppingAssistantStateUpdate> {
  const result =
    (await config?.configurable?.handlers?.orderLookup?.(state)) ??
    (await orderLookupNode(state, {
      orderLookupAdapter: config?.configurable?.orderLookupAdapter,
    }));
  return responseUpdate('order_lookup', result, state, AssistantIntent.ORDER_LOOKUP);
}

function isVoucherOnlyAdvisoryRequest(state: ShoppingAssistantStateType): boolean {
  const entities = state.parsedEntities ?? {};
  const plan = state.intentPlan ?? {};
  const action =
    asCheckoutAction(plan.checkoutAction) ??
    asCheckoutAction(entities.checkoutAction);
  if (action !== 'APPLY_VOUCHER' || asString(entities.voucherCode)) {
    return false;
  }

  const normalizedText = normalizeVietnameseText(state.userText ?? '');
  return !/thanh toan|checkout|dat hang|tao don|len don|chot don|mua hang/.test(normalizedText);
}

function normalizeVietnameseText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function routeOrder(
  state: ShoppingAssistantStateType,
): 'cart_action' | 'checkout_prep' | 'order_lookup' {
  if (state.intents?.includes(AssistantIntent.CART_ACTION)) return 'cart_action';
  if (state.intents?.includes(AssistantIntent.ORDER_LOOKUP)) return 'order_lookup';
  return 'checkout_prep';
}

async function buildCartActionInput(
  state: ShoppingAssistantStateType,
  config?: OrderConfig,
) {
  const entities = state.parsedEntities ?? {};
  const plan = state.intentPlan ?? {};
  const productId =
    asString(entities.productId) ??
    asString((state as any).productId) ??
    (await resolveProductIdFromEntity(entities, config));

  return {
    ...state,
    customerId: state.customerId ?? state.authenticatedUserId ?? '',
    intent: asString(plan.cartAction) ?? asString(entities.cartAction) ?? 'CART_ADD',
    productId,
    quantity: asNumber(entities.quantity) ?? asNumber((state as any).quantity),
  };
}

function buildCheckoutInput(state: ShoppingAssistantStateType) {
  const entities = state.parsedEntities ?? {};
  const plan = state.intentPlan ?? {};
  return {
    ...state,
    customerId: state.customerId ?? state.authenticatedUserId ?? '',
    subtotal: asNumber(entities.subtotal) ?? 0,
    selectedVoucherCode: asString(entities.voucherCode),
    action:
      asCheckoutAction(plan.checkoutAction) ??
      asCheckoutAction(entities.checkoutAction),
    checkout: asCheckoutFields(entities.checkout),
    reviewAccepted:
      Boolean(entities.checkoutReviewAccepted) ||
      Boolean(plan.checkoutReviewAccepted),
  };
}

async function resolveProductIdFromEntity(
  entities: Record<string, unknown>,
  config?: OrderConfig,
): Promise<string | undefined> {
  const productName =
    asString(entities.productName) ?? asString(entities.product);
  const catalogAdapter = config?.configurable?.catalogAdapter;
  const searchProducts =
    catalogAdapter?.searchProductsFast ?? catalogAdapter?.searchProducts;
  if (
    !productName ||
    typeof searchProducts !== 'function'
  ) {
    return undefined;
  }
  const result = await searchProducts.call(catalogAdapter, productName, {
    topK: 1,
  });
  const first = result?.results?.[0];
  return asString(first?.productId) ?? asString(first?.payload?.productId);
}

function responseUpdate(
  nodeName: string,
  result: any,
  state: ShoppingAssistantStateType,
  fallbackIntent: AssistantIntent,
  toolCalls: any[] = [],
): ShoppingAssistantStateUpdate {
  const response = normalizeResponse(nodeName, result, fallbackIntent);
  const actionDrafts = extractActionDrafts(result);
  const responseWithDraftMetadata: AssistantResponse = actionDrafts.length
    ? {
        ...response,
        metadata: {
          ...(response.metadata ?? {}),
          actionDrafts,
        },
      }
    : response;
  const allToolCalls = [
    ...toolCalls,
    ...(Array.isArray(responseWithDraftMetadata.metadata?.tool_calls)
      ? responseWithDraftMetadata.metadata.tool_calls
      : []),
  ];
  return {
    responses: [responseWithDraftMetadata],
    actionDrafts,
    routeTrace: [nodeName],
    toolResults: allToolCalls,
    traceEvents: [
      {
        roomId: state.roomId,
        node: nodeName,
        intent: responseWithDraftMetadata.intent as AssistantIntent,
        active_subgraph: 'order',
        tool_calls: allToolCalls,
      },
    ],
  };
}

function normalizeResponse(
  nodeName: string,
  result: any,
  fallbackIntent: AssistantIntent,
): AssistantResponse {
  const response = result as AssistantNodeResponse;
  return {
    intent: response?.intent ?? fallbackIntent,
    nodeName: response?.nodeName ?? nodeName,
    text: response?.text ?? fallbackText(nodeName, result),
    metadata: {
      ...(response?.metadata ?? result?.metadata ?? {}),
    },
  };
}

function fallbackText(nodeName: string, result: any): string {
  if (result?.type === 'assistant_action_draft') {
    return 'Mình đã chuẩn bị thao tác cần bạn xác nhận trong hệ thống GearVN.';
  }
  if (result?.type === 'clarification') return 'Mình cần thêm thông tin để tiếp tục.';
  return nodeName === 'order_lookup' ? 'Mình cần xác minh đơn hàng của bạn.' : '';
}

function extractActionDrafts(result: any) {
  return result?.draft ? [result.draft] : [];
}

function orderMergeNode(
  state: ShoppingAssistantStateType,
): ShoppingAssistantStateUpdate {
  const merged = mergeAssistantResponses(state.responses ?? []);
  return {
    text: merged.text,
    metadata: { ...(state.metadata ?? {}), ...merged.metadata },
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function hasQuantityValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

function asPositiveInteger(value: unknown): number | undefined {
  if (!hasQuantityValue(value)) return undefined;
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0
    ? numberValue
    : undefined;
}

function asCheckoutAction(
  value: unknown,
): 'APPLY_VOUCHER' | 'CHECKOUT_REDIRECT' | undefined {
  const action = asString(value);
  if (action === 'APPLY_VOUCHER' || action === 'CHECKOUT_REDIRECT') return action;
  return undefined;
}

function normalizeCartAction(value: unknown) {
  const action = asString(value);
  if (
    action === 'CART_ADD' ||
    action === 'CART_REMOVE' ||
    action === 'CART_SET_QUANTITY'
  ) {
    return action;
  }
  return 'CART_ADD';
}

function asCheckoutFields(value: unknown) {
  if (!isRecord(value)) return undefined;
  return {
    name: asString(value.name),
    phone: asString(value.phone),
    address: asString(value.address),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export const orderSubgraph = new StateGraph(ShoppingAssistantState)
  .addNode('cart_action', orderCartActionNode)
  .addNode('checkout_prep', orderCheckoutPrepNode)
  .addNode('order_lookup', orderLookupGraphNode)
  .addNode('order_merge', orderMergeNode)
  .addConditionalEdges(START, routeOrder)
  .addEdge('cart_action', 'order_merge')
  .addEdge('checkout_prep', 'order_merge')
  .addEdge('order_lookup', 'order_merge')
  .addEdge('order_merge', END)
  .compile();
