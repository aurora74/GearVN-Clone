import { AssistantIntent } from '../assistant.types';

type UnsupportedState = {
  userText?: string;
  promptContext?: unknown;
};

export function unsupportedNode(state: UnsupportedState = {}) {
  const text = state.userText ?? '';
  const greetingOnly = isGreetingOnly(text);
  const courtesyOnly = isCourtesyOnly(text);
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

  if (courtesyOnly) {
    return {
      intent: AssistantIntent.UNSUPPORTED,
      nodeName: 'unsupported',
      text: 'Không có gì, mình luôn sẵn sàng. Bạn cứ nhắn nhu cầu mua sắm, mình sẽ tiếp tục lọc và giải thích giúp bạn.',
      metadata: {
        courtesy: true,
        staffAlternative: true,
      },
    };
  }

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

function isCourtesyOnly(text: string): boolean {
  const normalized = normalizeVietnameseText(text);
  return /^(cam on|cam on nhe|ok cam on|ok cam on nhe|thanks|thank you|ok thanks|ok|duoc roi|tam biet|bye)$/.test(
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
  const sourceOrder = [
    'profileMemory',
    'preferenceNotes',
    'progressiveSummary',
    'cartContext',
    'hotMessages',
  ];
  const summaries = sourceOrder
    .map((kind) =>
      compactShoppingMemory(
        sections
          .filter((section) => section.kind === kind)
          .map((section) => section.content)
          .join('\n'),
      ),
    )
    .filter((summary): summary is string => Boolean(summary));
  const seen = new Set<string>();
  const merged = summaries.filter((summary) => {
    const key = normalizeVietnameseText(summary);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return merged.length ? merged.join('; ').slice(0, 320) : null;
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
  const isShoppingSignal = (line: string) => {
    const normalized = normalizeVietnameseText(line);
    return /laptop|pc|may tinh|gaming|game|\bai\b|machine learning|deep learning|cad|autocad|ky thuat|gpu|rtx|ngan sach|tam gia|trieu|uu tien|do hoa|render|giai tri|xem phim|ram|ssd|cpu|gio hang|checkout|thanh toan|dat hang/.test(
      normalized,
    );
  };
  const isRecallQuestion = (line: string) =>
    /\b(nho|biet|luu)\b.*(thich|quan tam|nhu cau|gi ve|\bminh\b|\btoi\b|\bem\b)/.test(
      normalizeVietnameseText(line),
    );
  const isAssistantOrSystemLine = (line: string) => {
    const normalized = normalizeVietnameseText(line);
    return (
      /^(assistant|system|ai):\s*/i.test(line) ||
      /minh (goi y|da ghi nhan|da them|chua|nho|co the|khong the|da dien|can ban|da chuan bi)|tro ly mua sam|ngoai pham vi/.test(
        normalized,
      )
    );
  };
  const cleanLine = (line: string) =>
    line.replace(/^(customer|user|assistant):\s*/i, '').trim();
  const customerRelevant = rawLines
    .filter((line) => /^(customer|user):/i.test(line))
    .filter((line) => isShoppingSignal(line) && !isRecallQuestion(line))
    .map(cleanLine);
  const relevant = rawLines
    .filter(
      (line) =>
        isShoppingSignal(line) &&
        !isRecallQuestion(line) &&
        !isAssistantOrSystemLine(line),
    )
    .map(cleanLine);
  const selectedLines = customerRelevant.length
    ? customerRelevant
    : relevant.length
      ? relevant
      : [];
  const factSummary = shoppingFactSummary(selectedLines);
  const summary = factSummary ?? selectedLines.slice(-4).join('; ');
  return summary ? summary.replace(/\s+/g, ' ').slice(0, 220) : null;
}

function shoppingFactSummary(lines: string[]): string | null {
  let category = '';
  let budget = '';
  const useCases: string[] = [];
  const constraints: string[] = [];
  const flowFacts: string[] = [];

  for (const line of lines) {
    const normalized = normalizeVietnameseText(line);
    category ||= shoppingCategoryFact(normalized);
    budget ||= shoppingBudgetFact(normalized);
    pushUnique(useCases, shoppingUseCaseFact(normalized));
    pushUnique(constraints, shoppingConstraintFact(normalized));
    pushUnique(flowFacts, shoppingFlowFact(normalized));
  }

  const parts = [
    category && useCases.length > 0 ? `${category} ${useCases[0]}` : category,
    !category && useCases.length > 0 ? useCases[0] : '',
    budget,
    ...constraints,
    ...useCases.slice(category ? 1 : 0),
    ...flowFacts,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join('; ') : null;
}

function shoppingCategoryFact(normalized: string): string {
  if (/\blaptop\b|may tinh xach tay/.test(normalized)) return 'laptop';
  if (/\bpc\b|may tinh de ban|may bo|desktop|workstation/.test(normalized))
    return 'PC';
  if (/\bmay tinh\b/.test(normalized)) return 'máy tính';
  if (/man hinh|monitor/.test(normalized)) return 'màn hình';
  if (/ban phim|keyboard/.test(normalized)) return 'bàn phím';
  if (/chuot|mouse/.test(normalized)) return 'chuột';
  if (/tai nghe|headset|headphone/.test(normalized)) return 'tai nghe';
  if (/\bssd\b/.test(normalized)) return 'SSD';
  if (/\bram\b/.test(normalized)) return 'RAM';
  if (/\bcpu\b/.test(normalized)) return 'CPU';
  if (/\bgpu\b|\bvga\b|card do hoa/.test(normalized)) return 'GPU';
  return '';
}

function shoppingBudgetFact(normalized: string): string {
  const match = normalized.match(
    /(?:ngan sach|tam gia|duoi|toi da|khoang|tam)?\s*(\d{1,3})\s*(?:trieu|tr)\b/,
  );
  return match ? `ngân sách ${match[1]} triệu` : '';
}

function shoppingUseCaseFact(normalized: string): string {
  if (/machine learning|deep learning|\bai\b/.test(normalized)) {
    return 'học machine learning';
  }
  if (/cad|autocad|solidworks|ky thuat/.test(normalized)) {
    return 'làm CAD/kỹ thuật';
  }
  if (/do hoa|render|photoshop|illustrator|premiere|creator/.test(normalized)) {
    return 'làm đồ họa/render';
  }
  if (/gaming|game|fps|esport/.test(normalized)) return 'gaming';
  if (/giai tri|xem phim|netflix|youtube/.test(normalized)) return 'giải trí';
  if (/lap trinh|code|van phong|hoc tap/.test(normalized)) return 'làm việc/học tập';
  return '';
}

function shoppingConstraintFact(normalized: string): string {
  if (/gpu|rtx|cuda|nvidia|vga/.test(normalized)) return 'ưu tiên GPU/RTX';
  if (/mong nhe|pin/.test(normalized)) return 'ưu tiên mỏng nhẹ/pin';
  if (/ram|ssd|nang cap/.test(normalized)) return 'ưu tiên RAM/SSD/nâng cấp';
  return '';
}

function shoppingFlowFact(normalized: string): string {
  if (/gio\s*hang|cart/.test(normalized)) return 'đã có sản phẩm trong giỏ hàng';
  if (/checkout|thanh toan|dat hang|dia chi|so dien thoai|sdt/.test(normalized)) {
    return 'đã có bước checkout/thanh toán';
  }
  return '';
}

function pushUnique(values: string[], value: string): void {
  if (value && !values.includes(value)) values.push(value);
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
