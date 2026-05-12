import { AssistantIntent } from '../assistant.types';

export type AssistantNodeResponse = {
  intent?: AssistantIntent | string;
  nodeName?: string;
  text?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type MergedAssistantResponse = {
  text: string;
  orderedNodeNames: string[];
  responses: AssistantNodeResponse[];
  metadata: Record<string, unknown>;
};

const MERGE_PRIORITY: AssistantIntent[] = [
  AssistantIntent.CART_ACTION,
  AssistantIntent.CHECKOUT_PREP,
  AssistantIntent.STAFF_HANDOFF,
  AssistantIntent.PRODUCT_ADVICE,
  AssistantIntent.REVIEW_SUMMARY,
  AssistantIntent.ORDER_LOOKUP,
  AssistantIntent.UNSUPPORTED,
];

export function mergeAssistantResponses(
  responses: AssistantNodeResponse[],
): MergedAssistantResponse {
  const ordered = [...responses]
    .filter((response) => response && (response.text || response.nodeName))
    .sort((left, right) => priority(left) - priority(right));

  return {
    text: ordered
      .map((response) => response.text)
      .filter((text): text is string => Boolean(text?.trim()))
      .join('\n\n'),
    orderedNodeNames: ordered
      .map((response) => response.nodeName)
      .filter((nodeName): nodeName is string => Boolean(nodeName)),
    responses: ordered,
    metadata: mergeMetadata(ordered),
  };
}

function priority(response: AssistantNodeResponse): number {
  const intent = response.intent;
  const index = MERGE_PRIORITY.indexOf(intent as AssistantIntent);
  return index === -1 ? MERGE_PRIORITY.length : index;
}

function mergeMetadata(
  responses: AssistantNodeResponse[],
): Record<string, unknown> {
  return responses.reduce<Record<string, unknown>>((metadata, response) => {
    if (!response.metadata) return metadata;
    return { ...metadata, ...response.metadata };
  }, {});
}
