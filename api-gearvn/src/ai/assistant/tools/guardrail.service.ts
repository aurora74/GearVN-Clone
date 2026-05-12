import { Injectable } from '@nestjs/common';

import {
  AssistantGuardrailDecision,
  AssistantIntent,
  AssistantSubgraphName,
  SupervisorDecision,
} from '../assistant.types';
import { ShoppingAssistantStateType } from '../shopping-assistant.state';

export type GuardrailValidationResult = {
  decision: SupervisorDecision;
  guardrailDecision: AssistantGuardrailDecision;
  blocked: boolean;
};

const VALID_ROUTES = new Set<AssistantSubgraphName>([
  'sales',
  'order',
  'general',
]);

@Injectable()
export class GuardrailService {
  validateSupervisorDecision(
    state: ShoppingAssistantStateType,
    decision: SupervisorDecision,
  ): GuardrailValidationResult {
    const route = decision.route;
    if (!VALID_ROUTES.has(route)) {
      return this.block(decision, 'UNKNOWN_ROUTE_BLOCKED');
    }

    if (this.hasDirectOrderPaymentIntent(state, decision)) {
      return this.block(decision, 'DIRECT_ORDER_PAYMENT_BLOCKED');
    }

    if (this.hasOwnerOverride(state)) {
      return this.block(decision, 'OWNER_OVERRIDE_BLOCKED');
    }

    if (this.hasPhase10DeferredRequest(state)) {
      return this.block(decision, 'PHASE_10_DEFERRED');
    }

    if (this.hasOutOfScopeCreativeRequest(state)) {
      return this.block(decision, 'SUPERVISOR_OUT_OF_SCOPE');
    }
    return {
      decision,
      blocked: false,
      guardrailDecision: {
        rule: 'SUPERVISOR_ROUTE_ALLOWED',
        action: 'allow',
        subgraph: route,
      },
    };
  }

  private block(
    decision: SupervisorDecision,
    rule: string,
  ): GuardrailValidationResult {
    const blockedDecision: SupervisorDecision = {
      ...decision,
      route: 'general',
      confidence: 0,
      intents: [AssistantIntent.UNSUPPORTED],
      fallbackReason: rule,
    };
    return {
      decision: blockedDecision,
      blocked: true,
      guardrailDecision: {
        rule,
        action: 'block',
        reason: rule,
        subgraph: 'general',
      },
    };
  }

  private hasDirectOrderPaymentIntent(
    state: ShoppingAssistantStateType,
    decision: SupervisorDecision,
  ): boolean {
    const text = normalizedText(state.userText);
    const directAction =
      /thanh\s*toan\s*(luon|giup|ho|thay)|thanh\s*toán\s*(luôn|giúp|hộ|thay)|reserve|giu\s*hang|giữ\s*hàng|tru\s*kho|trừ\s*kho|ton\s*kho|tồn\s*kho/.test(
        text,
      );
    const directIntent = decision.intents.some((intent) =>
      [
        'DIRECT_ORDER',
        'DIRECT_PAYMENT',
        'VOUCHER_RESERVATION',
        'INVENTORY_MUTATION',
      ].includes(String(intent)),
    );
    return directAction || directIntent;
  }

  private hasOwnerOverride(state: ShoppingAssistantStateType): boolean {
    return /bo qua.*(chu so huu|owner|tai khoan|tài khoản)|xem don hang nguoi khac|xem đơn hàng người khác|override.*owner/i.test(
      state.userText ?? '',
    );
  }

  private hasPhase10DeferredRequest(
    state: ShoppingAssistantStateType,
  ): boolean {
    const text = normalizedText(state.userText);
    const asksPolicyProcess =
      /chinh sach doi tra|doi tra|tra hang|hoan tien|refund|return policy/.test(
        text,
      );
    return asksPolicyProcess && !hasShoppingProductContext(text);
  }

  private hasOutOfScopeCreativeRequest(
    state: ShoppingAssistantStateType,
  ): boolean {
    const text = normalizedText(state.userText);
    if (!/viet tho|lam tho|ke chuyen|bai van|code giup/.test(text)) {
      return false;
    }
    return !hasShoppingProductContext(text);
  }
}

function normalizedText(text?: string): string {
  return (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function hasShoppingProductContext(text: string): boolean {
  return /laptop|\bpc\b|may tinh|linh kien|san pham|man hinh|ban phim|chuot|tai nghe|ssd|ram|cpu|gpu|vga|gearvn|bao hanh|warranty|so sanh/.test(
    text,
  );
}
