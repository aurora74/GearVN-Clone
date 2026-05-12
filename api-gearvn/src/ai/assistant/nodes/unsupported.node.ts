import { AssistantIntent } from '../assistant.types';

type UnsupportedState = {
  userText?: string;
  promptContext?: unknown;
};

export function unsupportedNode(state: UnsupportedState = {}) {
  const text = state.userText ?? '';
  const greetingOnly = isGreetingOnly(text);
  const requestsOrderCreation = /tao don|tạo đơn|dat hang|đặt hàng/i.test(text);
  const requestsPayment = /thanh toan|thanh toán|payment|vnpay/i.test(text);
  const memoryRecall = buildMemoryRecallResponse(state);

  if (greetingOnly) {
    return {
      intent: AssistantIntent.UNSUPPORTED,
      nodeName: 'unsupported',
      text: 'Chào bạn, mình là GearVN AI. Mình có thể tư vấn laptop, PC, linh kiện, kiểm tra giỏ hàng, hỗ trợ thanh toán hoặc tra cứu đơn hàng. Bạn đang cần mình hỗ trợ gì?',
      metadata: {
        greeting: true,
        staffAlternative: true,
      },
    };
  }

  if (memoryRecall) return memoryRecall;

  return {
    intent: AssistantIntent.UNSUPPORTED,
    nodeName: 'unsupported',
    text: buildUnsupportedText(requestsOrderCreation, requestsPayment),
    metadata: {
      unsupportedReason:
        requestsOrderCreation || requestsPayment
          ? 'direct_order_or_payment_creation'
          : 'out_of_scope',
      checkoutAlternative: requestsOrderCreation || requestsPayment,
      staffAlternative: true,
    },
  };
}

function isGreetingOnly(text: string): boolean {
  const normalized = normalizeVietnameseText(text);

  return /^(hi|hello|hey|alo|chao|xin chao|chao ban|chao shop|shop oi|gearvn oi)$/.test(
    normalized,
  );
}

function buildUnsupportedText(
  requestsOrderCreation: boolean,
  requestsPayment: boolean,
): string {
  if (requestsOrderCreation || requestsPayment) {
    return [
      requestsOrderCreation
        ? 'Mình không thể tạo đơn hàng trực tiếp trong chat.'
        : '',
      requestsPayment
        ? 'Mình không thể thực hiện thanh toán hoặc tạo giao dịch thanh toán thay bạn.'
        : '',
      'Mình có thể chuẩn bị thông tin và đưa bạn sang trang giỏ hàng/thanh toán để hệ thống GearVN xử lý an toàn.',
      'Nếu cần tư vấn thêm, mình có thể chuyển sang nhân viên hỗ trợ.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  return 'Mình chưa hỗ trợ yêu cầu này trong trợ lý mua sắm GearVN. Bạn có thể hỏi về sản phẩm, giỏ hàng, thanh toán, đơn hàng, đánh giá hoặc chuyển nhân viên tư vấn.';
}

function buildMemoryRecallResponse(state: UnsupportedState) {
  if (!isMemoryRecallRequest(state.userText ?? '')) return null;

  const summary = memorySummaryFromPromptContext(state.promptContext);
  const memoryUsed = summary
    ? [
        {
          kind: 'preference',
          label: 'conversation_context',
          redactedValue: summary,
        },
      ]
    : [];

  return {
    intent: AssistantIntent.UNSUPPORTED,
    nodeName: 'unsupported',
    text: summary
      ? `Mình nhớ bạn đang quan tâm ${summary}. Bạn muốn mình dùng thông tin này để lọc sản phẩm tiếp không?`
      : 'Mình chưa thấy sở thích mua sắm đã lưu trong cuộc trò chuyện này. Bạn cho mình biết nhu cầu, ngân sách và ưu tiên chính, mình sẽ ghi nhớ để tư vấn tiếp.',
    metadata: {
      memoryRecall: true,
      memory_used: memoryUsed,
    },
  };
}

function isMemoryRecallRequest(text: string): boolean {
  const normalized = normalizeVietnameseText(text);
  return /\bnho\b.*(thich|quan tam|nhu cau|gi ve|\bminh\b|\btoi\b|\bem\b)|\b(biet|luu)\b.*(\bminh\b|\btoi\b|\bem\b)|so thich/.test(
    normalized,
  );
}

function memorySummaryFromPromptContext(promptContext: unknown): string | null {
  const sections = promptContextSections(promptContext);
  const preferredKinds = [
    'profileMemory',
    'preferenceNotes',
    'progressiveSummary',
    'hotMessages',
  ];
  const combined = preferredKinds
    .map((kind) => sections.find((section) => section.kind === kind)?.content)
    .filter((content): content is string => Boolean(content))
    .join('\n');
  return compactShoppingMemory(combined);
}

function promptContextSections(
  promptContext: unknown,
): Array<{ kind?: string; content?: string }> {
  if (!promptContext || typeof promptContext !== 'object') return [];
  const sections = (promptContext as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return [];
  const parsed: Array<{ kind?: string; content?: string }> = [];
  for (const section of sections) {
    if (!section || typeof section !== 'object') continue;
    const record = section as { kind?: unknown; content?: unknown };
    const content =
      typeof record.content === 'string' ? record.content : undefined;
    if (!content) continue;
    parsed.push({
      kind: typeof record.kind === 'string' ? record.kind : undefined,
      content,
    });
  }
  return parsed;
}

function compactShoppingMemory(text: string): string | null {
  const rawLines = text
    .split(/\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean);
  const isShoppingSignal = (line: string) =>
    /laptop|pc|máy tính|may tinh|gaming|game|ai|machine learning|gpu|rtx|ngân sách|ngan sach|triệu|trieu|ưu tiên|uu tien/i.test(
      line,
    );
  const isRecallQuestion = (line: string) =>
    /\b(nho|biet|luu)\b.*(thich|quan tam|nhu cau|gi ve|\bminh\b|\btoi\b|\bem\b)|nhớ.*(thích|quan tâm|nhu cầu|gì về|\bmình\b|\btôi\b|\bem\b)/i.test(
      normalizeVietnameseText(line),
    );
  const cleanLine = (line: string) =>
    line.replace(/^(customer|assistant):\s*/i, '').trim();
  const customerRelevant = rawLines
    .filter((line) => /^customer:/i.test(line))
    .filter((line) => isShoppingSignal(line) && !isRecallQuestion(line))
    .map(cleanLine);
  const relevant = rawLines
    .filter((line) => isShoppingSignal(line) && !isRecallQuestion(line))
    .map(cleanLine);
  const lines = rawLines.map(cleanLine);
  const summary = (
    customerRelevant.length
      ? customerRelevant
      : relevant.length
        ? relevant
        : lines
  )
    .slice(-4)
    .join('; ');
  return summary ? summary.replace(/\s+/g, ' ').slice(0, 220) : null;
}

function normalizeVietnameseText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
