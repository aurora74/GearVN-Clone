import { ChatOpenRouter } from '@langchain/openrouter';
import { z } from 'zod';

import { ORDER_STATUS } from '../../../config.global';
import { AssistantIntent } from '../assistant.types';
import {
  assertAssistantModelCapabilities,
  readAssistantModelConfig,
} from '../config/assistant-model.config';

const ASSISTANT_INTENTS = Object.values(AssistantIntent) as [
  AssistantIntent,
  ...AssistantIntent[],
];
const MAX_SCHEMA_RETRIES = 2;

export const ClassifyIntentsResultSchema = z.object({
  primaryIntent: z.enum(ASSISTANT_INTENTS),
  intents: z.array(z.enum(ASSISTANT_INTENTS)).min(1).max(4),
  confidence: z.number().min(0).max(1).optional(),
  entities: z.record(z.string(), z.unknown()).optional(),
  reason: z.string().optional(),
});

export type ClassifyIntentsResult = z.infer<typeof ClassifyIntentsResultSchema>;

type ClassifyIntentsState = {
  userText?: string;
};

type ClassifierAdapter = {
  classify(text: string): Promise<unknown>;
};

type ClassifyConfig = {
  configurable?: {
    classifier?: ClassifierAdapter;
  };
};

export async function classifyIntentsNode(
  state: ClassifyIntentsState,
  config?: ClassifyConfig,
): Promise<ClassifyIntentsResult> {
  assertConfiguredCapabilities();
  const classifier =
    config?.configurable?.classifier ?? createOpenRouterClassifier();
  const userText = state.userText ?? '';
  const safeUserText = redactCustomerPii(userText);
  const greeting = greetingClassification(userText);
  if (greeting) return greeting;
  const deterministic = deterministicCommerceClassification(userText);
  if (deterministic) return deterministic;

  for (let attempt = 0; attempt <= MAX_SCHEMA_RETRIES; attempt += 1) {
    try {
      const raw = classifier
        ? await classifier.classify(safeUserText)
        : heuristicClassify(userText);
      const parsed = parseClassification(raw);
      if (parsed) return parsed;
    } catch {
      // Retry schema/model failures, then return the safe unsupported boundary.
    }
  }

  return unsupportedClassification('classification_schema_failed');
}

function assertConfiguredCapabilities() {
  const config = readAssistantModelConfig().openRouter;
  return assertAssistantModelCapabilities({
    supportsStructuredOutputs: config.provider.require_parameters === true,
    supportsReviewSearch:
      config.reviewSearch.preferredTool === 'openrouter:web_search' ||
      config.reviewSearch.directApiFallback === true,
  });
}

function createOpenRouterClassifier(): ClassifierAdapter | null {
  const config = readAssistantModelConfig().openRouter;
  const apiKey = config.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const model = new (ChatOpenRouter as any)({
    apiKey,
    model: config.chatModel,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    provider: config.provider,
    modelKwargs: {
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'assistant_intent_classification',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['primaryIntent', 'intents'],
            properties: {
              primaryIntent: { enum: ASSISTANT_INTENTS },
              intents: {
                type: 'array',
                minItems: 1,
                maxItems: 4,
                items: { enum: ASSISTANT_INTENTS },
              },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              entities: { type: 'object' },
              reason: { type: 'string' },
            },
          },
        },
      },
    },
  });

  return {
    async classify(text) {
      const response = await model.invoke([
        {
          role: 'system',
          content:
            'Classify GearVN ecommerce assistant messages into the provided intent enum. Return strict JSON only.',
        },
        { role: 'user', content: text },
      ]);
      return response?.content;
    },
  };
}

function parseClassification(raw: unknown): ClassifyIntentsResult | null {
  const candidate =
    typeof raw === 'string'
      ? tryParseJson(raw)
      : raw && typeof raw === 'object'
        ? raw
        : null;
  const parsed = ClassifyIntentsResultSchema.safeParse(
    normalizeCandidate(candidate),
  );
  if (!parsed.success) return null;
  const intents = uniqueIntents(parsed.data.intents);
  const primaryIntent = intents.includes(parsed.data.primaryIntent)
    ? parsed.data.primaryIntent
    : intents[0];
  return { ...parsed.data, primaryIntent, intents };
}

function normalizeCandidate(candidate: unknown) {
  if (!candidate || typeof candidate !== 'object') return candidate;
  const record = candidate as Record<string, unknown>;
  const primaryIntent = record.primaryIntent ?? record.intent;
  const intents = Array.isArray(record.intents)
    ? record.intents
    : primaryIntent
      ? [primaryIntent]
      : undefined;
  return { ...record, primaryIntent, intents };
}

function heuristicClassify(text: string): ClassifyIntentsResult {
  const normalized = text.toLowerCase();
  const intents: AssistantIntent[] = [];

  if (/review|danh gia|đánh giá|so sanh|so sánh/.test(normalized)) {
    intents.push(AssistantIntent.REVIEW_SUMMARY);
  }
  if (
    /gio hang|giỏ hàng|them vao gio|thêm vào giỏ|xoa khoi gio|xóa khỏi giỏ/.test(
      normalized,
    )
  ) {
    intents.push(AssistantIntent.CART_ACTION);
  }
  if (/thanh toan|checkout|voucher|dat hang|đặt hàng/.test(normalized)) {
    intents.push(AssistantIntent.CHECKOUT_PREP);
  }
  if (/don hang|đơn hàng|trang thai don|trạng thái đơn/.test(normalized)) {
    intents.push(AssistantIntent.ORDER_LOOKUP);
  }
  const explicitStaffHandoff =
    /nhan vien|nhân viên|tu van vien|tư vấn viên|csr/.test(normalized);
  if (explicitStaffHandoff) {
    intents.push(AssistantIntent.STAFF_HANDOFF);
  }
  if (
    !explicitStaffHandoff &&
    /laptop|pc|gearvn|san pham|sản phẩm|tu van|tư vấn|mua/.test(normalized)
  ) {
    intents.unshift(AssistantIntent.PRODUCT_ADVICE);
  }

  const unique = uniqueIntents(intents);
  if (unique.length === 0)
    return unsupportedClassification('heuristic_no_match');
  return {
    primaryIntent: unique[0],
    intents: unique,
    confidence: 0.55,
    entities: extractCommerceEntities(text),
  };
}
function deterministicCommerceClassification(
  text: string,
): ClassifyIntentsResult | null {
  const result = heuristicClassify(text);
  if (result.primaryIntent === AssistantIntent.UNSUPPORTED) return null;
  const deterministicIntents = new Set<AssistantIntent>([
    AssistantIntent.PRODUCT_ADVICE,
    AssistantIntent.CART_ACTION,
    AssistantIntent.CHECKOUT_PREP,
    AssistantIntent.ORDER_LOOKUP,
    AssistantIntent.STAFF_HANDOFF,
  ]);
  if (!result.intents.some((intent) => deterministicIntents.has(intent))) {
    return null;
  }
  return {
    ...result,
    confidence: Math.max(result.confidence ?? 0, 0.75),
    reason: 'deterministic_commerce_flow',
  };
}

function extractCommerceEntities(text: string): Record<string, unknown> {
  const normalized = text.toLowerCase();
  const entities: Record<string, unknown> = {};
  const quantity = normalized.match(
    /(?:so luong|số lượng|qty|quantity)?\s*(\d{1,3})\b/,
  );
  if (quantity) entities.quantity = Number(quantity[1]);

  const productId = text.match(
    /(?:productId|product_id|san pham|sản phẩm)[:#\s-]+([a-f0-9]{24}|[A-Za-z0-9_-]{6,})/i,
  );
  if (productId) entities.productId = productId[1];

  const voucher = text.match(
    /(?:voucher|coupon|ma giam gia|mã giảm giá|ma|mã)[:#\s-]+([A-Z0-9_-]{3,24})/i,
  );
  if (voucher) entities.voucherCode = voucher[1].toUpperCase();

  if (/xoa|xóa|remove/.test(normalized)) {
    entities.cartAction = 'CART_REMOVE';
    entities.quantity = 0;
  } else if (
    /cap nhat|cập nhật|doi so luong|đổi số lượng|set quantity/.test(normalized)
  ) {
    entities.cartAction = 'CART_SET_QUANTITY';
  } else if (/gio hang|giỏ hàng|cart|them|thêm/.test(normalized)) {
    entities.cartAction = 'CART_ADD';
  }

  if (/voucher|coupon|ma giam gia|mã giảm giá/.test(normalized)) {
    entities.checkoutAction = 'APPLY_VOUCHER';
  } else if (/thanh toan|checkout|dat hang|đặt hàng/.test(normalized)) {
    entities.checkoutAction = 'CHECKOUT_REDIRECT';
  }

  if (
    /xem them|xem thêm|them lua chon|thêm lựa chọn|lua chon khac|lựa chọn khác|có máy khác nữa không|co may khac nua khong|máy khác|may khac|mẫu khác|mau khac|sản phẩm khác|san pham khac|more options/.test(
      normalized,
    )
  ) {
    entities.requestedMoreOptions = true;
  }

  if (
    !entities.requestedMoreOptions &&
    isBroadProductAdviceRequest(normalized)
  ) {
    entities.broadNeed = true;
  }

  const orderStatus = extractOrderStatus(normalized);
  if (orderStatus) entities.orderStatus = orderStatus;

  return entities;
}

function extractOrderStatus(text: string): string | undefined {
  if (/dang giao|đang giao|shipping|ship/.test(text))
    return ORDER_STATUS.SHIPPING;
  if (/da huy|đã hủy|cancel/.test(text)) return ORDER_STATUS.CANCELLED;
  if (/hoan tat|hoàn tất|completed|complete/.test(text))
    return ORDER_STATUS.COMPLETED;
  if (/dang xu ly|đang xử lý|processing|cho xu ly|chờ xử lý/.test(text)) {
    return ORDER_STATUS.PROCESSING;
  }
  if (/don hang|đơn hàng|order/.test(text)) return ORDER_STATUS.PROCESSING;
  return undefined;
}

function redactCustomerPii(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(?:\+?84|0)(?:[\s.-]?\d){8,10}\b/g, '[redacted-phone]')
    .replace(/\b(?:GVN|DH|ORDER)[-_]?\d{3,}\b/gi, '[redacted-order]')
    .replace(
      /(?:dia chi|địa chỉ|address)\s*[:：]?\s*[^,.;\n]+/gi,
      'address: [redacted-address]',
    )
    .replace(
      /(?:ten|tên|name)\s*[:：]?\s*[^,.;\n]+/gi,
      'name: [redacted-name]',
    );
}
function greetingClassification(text: string): ClassifyIntentsResult | null {
  return isGreetingOnly(text) ? unsupportedClassification('greeting') : null;
}

function isGreetingOnly(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return /^(hi|hello|hey|alo|chao|xin chao|chao ban|chao shop|shop oi|gearvn oi)$/.test(
    normalized,
  );
}

function isBroadProductAdviceRequest(text: string): boolean {
  const normalized = normalizeProductAdviceText(text);
  const asksForAdvice = /\b(tu van|goi y|can mua|can|nen mua|chon)\b/.test(
    normalized,
  );
  const mentionsGenericProduct = /\b(laptop|pc|may tinh|san pham)\b/.test(
    normalized,
  );
  if (!asksForAdvice || !mentionsGenericProduct) return false;

  return !specificProductAdviceResidual(normalized);
}

function normalizeProductAdviceText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\blaptp\b/g, 'laptop')
    .replace(/\blap\s+tp\b/g, 'laptop')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function specificProductAdviceResidual(normalized: string): string {
  return normalized
    .replace(
      /\b(tu van|goi y|can mua|can|nen mua|chon|ve|cho|minh|toi|em|shop|nhe|nha|giup|voi|tao|tui|to|ban|co|a|anh|chi|de)\b/g,
      ' ',
    )
    .replace(/\b(laptop|pc|may tinh|san pham|mau|may|bo)\b/g, ' ')
    .replace(/\b(pho thong|co ban|basic|entry level)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unsupportedClassification(reason: string): ClassifyIntentsResult {
  return {
    primaryIntent: AssistantIntent.UNSUPPORTED,
    intents: [AssistantIntent.UNSUPPORTED],
    confidence: 0,
    reason,
  };
}

function uniqueIntents(intents: AssistantIntent[]): AssistantIntent[] {
  return Array.from(new Set(intents)).slice(0, 4);
}

function tryParseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}
