import { Injectable } from '@nestjs/common';

type HandoffSummaryInput = {
  roomId?: string;
  transcriptRoomId?: string;
  need?: string;
  shoppingNeed?: string;
  budget?: string;
  constraints?: string[];
  constraintsAndSpecs?: string[];
  productsDiscussed?: unknown[];
  discussedProducts?: unknown[];
  cartCheckoutContext?: string | string[];
  cartContext?: string | string[];
  checkoutContext?: string | string[];
  orderContext?: string | string[];
  unresolvedQuestions?: string[];
  confidence?: string;
  uncertainty?: string | string[];
};

export type AssistantHandoffSummary = {
  need: string;
  budget: string;
  constraints: string[];
  productsDiscussed: unknown[];
  cartCheckoutContext: string;
  cartContext: string[];
  checkoutContext: string[];
  orderContext: string[];
  unresolvedQuestions: string[];
  confidence: string;
  uncertainty: string | string[];
  latestHandoffAt: string;
  staffOnly: true;
  transcriptRoomId: string;
};

@Injectable()
export class StaffHandoffSummaryService {
  build(input: HandoffSummaryInput): AssistantHandoffSummary {
    const cartContext = normalizeStringList(input.cartContext);
    const checkoutContext = normalizeStringList(input.checkoutContext);

    return {
      need: input.need ?? input.shoppingNeed ?? '',
      budget: input.budget ?? '',
      constraints: input.constraints ?? input.constraintsAndSpecs ?? [],
      productsDiscussed: input.productsDiscussed ?? input.discussedProducts ?? [],
      cartCheckoutContext:
        normalizeText(input.cartCheckoutContext) ??
        [...cartContext, ...checkoutContext].join('\n'),
      cartContext,
      checkoutContext,
      orderContext: normalizeStringList(input.orderContext),
      unresolvedQuestions: input.unresolvedQuestions ?? [],
      confidence: input.confidence ?? 'medium',
      uncertainty: input.uncertainty ?? '',
      latestHandoffAt: new Date().toISOString(),
      staffOnly: true,
      transcriptRoomId: input.transcriptRoomId ?? input.roomId ?? '',
    };
  }
}

function normalizeText(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) return value.filter(Boolean).join('\n');
  return value;
}

function normalizeStringList(value?: string | string[]): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}
