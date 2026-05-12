import {
  routeAfterClassification,
  shoppingAssistantGraph,
} from './shopping-assistant.graph';
import { mergeAssistantResponses } from './nodes/merge-response.node';
import { AssistantIntent, AssistantMode } from './assistant.types';

const mockOpenRouterInvoke = jest.fn();

jest.mock('@langchain/openrouter', () => ({
  ChatOpenRouter: jest.fn().mockImplementation(() => ({
    invoke: mockOpenRouterInvoke,
  })),
}));

const nodeNames = [
  'supervisor',
  'guardrail',
  'sales',
  'order',
  'general',
  'merge_response',
] as const;

const createGraphConfig = () => ({
  configurable: {
    classifier: {
      classify: jest.fn(),
    },
    model: {
      invoke: jest.fn(),
    },
    retrieval: {
      search: jest.fn(),
    },
    responseMergeModel: {
      invoke: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          finalMessage: 'Da tong hop cac ket qua phu hop.',
          priorityOrder: [],
          selectedResponseIds: [],
          droppedDuplicateResponseIds: [],
          metadataPreserved: [],
          factSources: [],
          unsupportedReason: null,
          confidence: 0.9,
        }),
      }),
    },
    handlers: {
      productAdvice: jest.fn().mockResolvedValue({
        intent: AssistantIntent.PRODUCT_ADVICE,
        nodeName: 'product_advice',
        text: 'San pham phu hop.',
      }),
      reviewSummary: jest.fn(),
      productDetail: jest.fn(),
      productContextResolver: jest.fn(),
      cartAction: jest.fn(),
      checkoutPrep: jest.fn(),
      orderLookup: jest.fn().mockResolvedValue({
        intent: AssistantIntent.ORDER_LOOKUP,
        nodeName: 'order_lookup',
        text: 'Trang thai don hang.',
      }),
      staffHandoff: jest.fn().mockResolvedValue({
        intent: AssistantIntent.STAFF_HANDOFF,
        nodeName: 'staff_handoff',
        text: 'Chuyen sang nhan vien tu van.',
      }),
      unsupported: jest.fn().mockResolvedValue({
        intent: AssistantIntent.UNSUPPORTED,
        nodeName: 'unsupported',
        text: 'Minh chua ho tro yeu cau nay.',
      }),
    },
  },
});

describe('shoppingAssistantGraph', () => {
  beforeEach(() => {
    mockOpenRouterInvoke.mockReset();
    delete process.env.OPENROUTER_API_KEY;
  });

  it('routes supported AI mode intents through explicit graph nodes', async () => {
    const config = createGraphConfig();
    const classifier = config.configurable.classifier.classify;
    classifier.mockImplementation(async (text: string) => {
      if (/don hang/i.test(text)) {
        return {
          route: 'order',
          intents: [AssistantIntent.ORDER_LOOKUP],
          confidence: 0.92,
        };
      }
      if (/nhan vien/i.test(text)) {
        return {
          route: 'general',
          intents: [AssistantIntent.STAFF_HANDOFF],
          confidence: 0.91,
        };
      }
      if (/tho/i.test(text)) {
        return {
          route: 'general',
          intents: [AssistantIntent.UNSUPPORTED],
          confidence: 0.4,
          fallbackReason: 'unsupported_scope',
        };
      }
      return {
        route: 'sales',
        intents: [AssistantIntent.PRODUCT_ADVICE],
        confidence: 0.93,
      };
    });

    await expect(
      shoppingAssistantGraph.invoke(
        {
          mode: AssistantMode.AI,
          roomId: 'room-client-a',
          userText: 'Tu van laptop hoc AI',
        },
        config,
      ),
    ).resolves.toMatchObject({
      routeTrace: ['supervisor', 'sales', 'product_advice', 'merge_response'],
    });
    await expect(
      shoppingAssistantGraph.invoke(
        {
          mode: AssistantMode.AI,
          roomId: 'room-client-a',
          userText: 'Kiem tra don hang cua toi',
        },
        config,
      ),
    ).resolves.toMatchObject({
      routeTrace: ['supervisor', 'order', 'order_lookup', 'merge_response'],
    });
    await expect(
      shoppingAssistantGraph.invoke(
        {
          mode: AssistantMode.AI,
          roomId: 'room-client-a',
          userText: 'Chat voi nhan vien tu van',
        },
        config,
      ),
    ).resolves.toMatchObject({
      routeTrace: ['supervisor', 'general', 'staff_handoff', 'merge_response'],
    });
    await expect(
      shoppingAssistantGraph.invoke(
        {
          mode: AssistantMode.AI,
          roomId: 'room-client-a',
          userText: 'Viet giup toi mot bai tho',
        },
        config,
      ),
    ).resolves.toMatchObject({
      routeTrace: ['supervisor', 'general', 'unsupported', 'merge_response'],
    });

    expect(
      routeAfterClassification({
        primaryIntent: AssistantIntent.PRODUCT_ADVICE,
      }),
    ).toBe('product_advice');
    expect(
      routeAfterClassification({ primaryIntent: AssistantIntent.ORDER_LOOKUP }),
    ).toBe('order_lookup');
    expect(
      routeAfterClassification({
        primaryIntent: AssistantIntent.STAFF_HANDOFF,
      }),
    ).toBe('staff_handoff');
    expect(
      routeAfterClassification({ primaryIntent: AssistantIntent.UNSUPPORTED }),
    ).toBe('unsupported');
    expect(nodeNames).toContain('supervisor');
    expect(nodeNames).toContain('sales');
    expect(nodeNames).toContain('order');
    expect(nodeNames).toContain('general');
    expect(nodeNames).toContain('merge_response');
  });

  it('answers greeting-only messages without invoking classifier or supervisor LLM', async () => {
    const classifier = jest.fn();
    const supervisorModel = { invoke: jest.fn() };

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        userText: 'hello',
      },
      {
        configurable: {
          classifier: { classify: classifier },
          supervisorModel,
        },
      },
    );

    expect(classifier).not.toHaveBeenCalled();
    expect(supervisorModel.invoke).not.toHaveBeenCalled();
    expect(result.routeTrace).toEqual([
      'supervisor',
      'general',
      'unsupported',
      'merge_response',
    ]);
    expect(result.text).toContain('Chào bạn');
    expect(result.text).not.toContain('Mình chưa thể phân luồng');
    expect(result.metadata).toMatchObject({
      fallback_reason: 'deterministic_bypass',
      deterministic_bypass: true,
    });
  });

  it('uses heuristic routing on supervisor failure without leaking fallback text', async () => {
    const supervisorModel = {
      invoke: jest.fn().mockRejectedValue(new Error('bad supervisor json')),
    };
    const productAdvice = jest.fn().mockResolvedValue({
      intent: AssistantIntent.PRODUCT_ADVICE,
      nodeName: 'product_advice',
      text: 'Laptop gaming phu hop.',
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        userText: 'so sánh laptop gaming khoảng 20 triệu',
      },
      {
        configurable: {
          supervisorModel,
          handlers: { productAdvice },
        },
      },
    );

    expect(supervisorModel.invoke).toHaveBeenCalledTimes(1);
    expect(productAdvice).toHaveBeenCalledTimes(1);
    expect(result.routeTrace).toEqual([
      'supervisor',
      'sales',
      'product_advice',
      'merge_response',
    ]);
    expect(result.text).toBe('Laptop gaming phu hop.');
    expect(result.text).not.toContain('Mình chưa thể phân luồng');
    expect(result.metadata?.fallback_reason).toBe('supervisor_model_failed');
    expect(result.metadata?.supervisor_decision).toMatchObject({
      route: 'sales',
      fallbackReason: 'supervisor_model_failed',
    });
  });
  it('keeps broad product constraints and continuation context when supervisor model fails', async () => {
    const supervisorModel = {
      invoke: jest.fn().mockRejectedValue(new Error('supervisor unavailable')),
    };
    const productAdvice = jest.fn().mockResolvedValue({
      intent: AssistantIntent.PRODUCT_ADVICE,
      nodeName: 'product_advice',
      text: 'Đã hiểu nhu cầu laptop của bạn.',
    });
    const config = {
      configurable: {
        supervisorModel,
        handlers: { productAdvice },
      },
    };

    const first = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        userText: 'mình cần laptop học AI tầm 25 triệu',
      },
      config,
    );

    expect(first.routeTrace).toEqual([
      'supervisor',
      'sales',
      'product_advice',
      'merge_response',
    ]);
    expect(productAdvice).toHaveBeenLastCalledWith(
      expect.objectContaining({
        parsedEntities: expect.objectContaining({ productCategory: 'laptop' }),
      }),
    );

    const continuation = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        userText: 'đổi sang cái rẻ hơn còn hàng',
        promptContext: {
          sections: [
            {
              kind: 'hotMessages',
              content: [
                'customer: mình cần laptop học AI tầm 25 triệu',
                'assistant: Mình gợi ý vài laptop còn hàng trong ngân sách.',
              ].join('\n'),
            },
          ],
        },
      },
      config,
    );

    expect(continuation.routeTrace).toEqual([
      'supervisor',
      'sales',
      'product_advice',
      'merge_response',
    ]);
    expect(productAdvice).toHaveBeenLastCalledWith(
      expect.objectContaining({
        parsedEntities: expect.objectContaining({
          productCategory: 'laptop',
          requestedMoreOptions: true,
          pricePreference: 'cheaper',
          stockRequired: true,
          contextResolutionReason: 'shopping_constraint_continuation',
        }),
      }),
    );

    const sortedMoreOptions = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        userText: 'gợi ý thêm sản phẩm, sort giá từ trên xuống dưới',
        promptContext: {
          sections: [
            {
              kind: 'hotMessages',
              content: [
                'customer: tư vấn laptop',
                'assistant: Mình cần thêm ngân sách và nhu cầu.',
                'customer: 40 triệu, học AI/ML',
                'assistant: Mình gợi ý vài laptop còn hàng trong ngân sách.',
              ].join('\n'),
            },
          ],
        },
      },
      config,
    );

    expect(sortedMoreOptions.routeTrace).toEqual([
      'supervisor',
      'sales',
      'product_advice',
      'merge_response',
    ]);
    expect(productAdvice).toHaveBeenLastCalledWith(
      expect.objectContaining({
        parsedEntities: expect.objectContaining({
          productCategory: 'laptop',
          requestedMoreOptions: true,
          priceSort: 'desc',
          contextResolutionReason: 'shopping_constraint_continuation',
          contextualUserText: expect.stringContaining('40 triệu, học AI/ML'),
        }),
        intentPlan: expect.objectContaining({
          requestedMoreOptions: true,
          priceSort: 'desc',
          contextualUserText: expect.stringContaining('40 triệu, học AI/ML'),
        }),
      }),
    );
  });

  it('enriches generic laptop advice with broadNeed even when classifier omits it', async () => {
    const config = createGraphConfig();
    config.configurable.classifier.classify.mockResolvedValue({
      route: 'sales',
      intents: [AssistantIntent.PRODUCT_ADVICE],
      confidence: 0.6,
      entities: {},
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        userText: 'mình cần tư vấn laptop',
      },
      config,
    );

    expect(config.configurable.handlers.productAdvice).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedEntities: expect.objectContaining({ broadNeed: true }),
        intentPlan: expect.objectContaining({ broadNeed: true }),
      }),
    );
    expect(
      config.configurable.handlers.productContextResolver,
    ).not.toHaveBeenCalled();
    expect(result.routeTrace).toEqual([
      'supervisor',
      'sales',
      'product_advice',
      'merge_response',
    ]);
  });

  it('removes accidental review intent from generic laptop advice', async () => {
    const config = createGraphConfig();
    config.configurable.classifier.classify.mockResolvedValue({
      route: 'sales',
      intents: [AssistantIntent.PRODUCT_ADVICE, AssistantIntent.REVIEW_SUMMARY],
      confidence: 0.95,
      entities: {},
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        userText: 'mình cần tư vấn laptop',
      },
      config,
    );

    expect(config.configurable.handlers.productAdvice).toHaveBeenCalledTimes(1);
    expect(config.configurable.handlers.reviewSummary).not.toHaveBeenCalled();
    expect(result.routeTrace).toEqual([
      'supervisor',
      'sales',
      'product_advice',
      'merge_response',
    ]);
  });
  it('keeps explicit product review requests on review summary only', async () => {
    const config = createGraphConfig();
    config.configurable.classifier.classify.mockResolvedValue({
      route: 'sales',
      intents: [AssistantIntent.PRODUCT_ADVICE, AssistantIntent.REVIEW_SUMMARY],
      confidence: 0.95,
      entities: {},
    });
    config.configurable.handlers.reviewSummary.mockResolvedValue({
      intent: AssistantIntent.REVIEW_SUMMARY,
      nodeName: 'review_summary',
      text: 'Mình chưa đủ nguồn đáng tin cậy để tóm tắt đánh giá.',
      metadata: { reviewSummary: { heading: 'review' } },
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        userText:
          'review chi tiết cho mình con Lenovo ThinkBook 14 G7 IML 21MR006YVN',
      },
      config,
    );

    expect(config.configurable.handlers.productAdvice).not.toHaveBeenCalled();
    expect(config.configurable.handlers.reviewSummary).toHaveBeenCalledTimes(1);
    expect(result.metadata?.supervisor_decision).toEqual(
      expect.objectContaining({
        intents: [AssistantIntent.REVIEW_SUMMARY],
      }),
    );
    expect(result.routeTrace).toEqual([
      'supervisor',
      'sales',
      'review_summary',
      'merge_response',
    ]);
  });

  it('routes typo budget laptop requests to product advice instead of unsupported', async () => {
    const config = createGraphConfig();
    config.configurable.classifier.classify.mockResolvedValue({
      route: 'general',
      intents: [AssistantIntent.UNSUPPORTED],
      confidence: 0.45,
      entities: {},
      fallbackReason: 'unsupported_scope',
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        userText: 'có laptp nào dưới 25 triệu ko bạn',
      },
      config,
    );

    expect(config.configurable.handlers.productAdvice).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedEntities: expect.objectContaining({ productCategory: 'laptop' }),
      }),
    );
    expect(config.configurable.handlers.unsupported).not.toHaveBeenCalled();
    expect(result.routeTrace).toEqual([
      'supervisor',
      'sales',
      'product_advice',
      'merge_response',
    ]);
  });

  it('uses configured OpenRouter supervisor for comparison-sensitive commerce routing', async () => {
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    mockOpenRouterInvoke.mockResolvedValueOnce({
      content: JSON.stringify({
        route: 'sales',
        intents: [AssistantIntent.PRODUCT_ADVICE],
        confidence: 0.91,
        entities: {
          productCategory: 'laptop',
          interpretedBy: 'llm-supervisor',
        },
        memoryRefs: [],
        modelName: 'openai/gpt-4o-mini',
      }),
    });
    const productAdvice = jest.fn().mockResolvedValue({
      intent: AssistantIntent.PRODUCT_ADVICE,
      nodeName: 'product_advice',
      text: 'Tư vấn laptop theo nhu cầu đã hiểu.',
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        userText: 'so sánh laptop gaming dưới 25 triệu',
      },
      {
        configurable: {
          handlers: { productAdvice },
        },
      },
    );

    expect(mockOpenRouterInvoke).toHaveBeenCalledTimes(1);
    expect(productAdvice).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedEntities: expect.objectContaining({
          productCategory: 'laptop',
          interpretedBy: 'llm-supervisor',
        }),
      }),
    );
    expect(result.routeTrace).toEqual([
      'supervisor',
      'sales',
      'product_advice',
      'merge_response',
    ]);
  });

  it('keeps confident LLM unsupported decisions for non-commerce requests', async () => {
    const config = createGraphConfig();
    config.configurable.classifier.classify.mockResolvedValue({
      route: 'general',
      intents: [AssistantIntent.UNSUPPORTED],
      confidence: 0.92,
      entities: { interpretedBy: 'llm-supervisor' },
      fallbackReason: 'unsupported_scope',
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        userText: 'kể mình nghe chuyện cười về bóng đá',
      },
      config,
    );

    expect(config.configurable.handlers.unsupported).toHaveBeenCalledTimes(1);
    expect(config.configurable.handlers.productAdvice).not.toHaveBeenCalled();
    expect(result.routeTrace).toEqual([
      'supervisor',
      'general',
      'unsupported',
      'merge_response',
    ]);
  });

  it('corrects unsupported routing for product warranty questions', async () => {
    const config = createGraphConfig();
    config.configurable.classifier.classify.mockResolvedValue({
      route: 'general',
      intents: [AssistantIntent.UNSUPPORTED],
      confidence: 0.92,
      entities: { interpretedBy: 'llm-supervisor' },
      fallbackReason: 'unsupported_scope',
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        userText: 'laptop này bảo hành mấy năm?',
        promptContext: {
          sections: [
            {
              kind: 'hotMessages',
              content: [
                'customer: so sánh laptop gaming dưới 25 triệu',
                'assistant: Mình gợi ý ba mẫu MSI gaming trong tầm giá.',
                'customer: laptop này bảo hành mấy năm?',
              ].join('\n'),
            },
          ],
        },
      },
      config,
    );

    expect(config.configurable.handlers.productAdvice).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedEntities: expect.objectContaining({
          productCategory: 'laptop',
          contextualUserText: expect.stringContaining(
            'laptop gaming dưới 25 triệu',
          ),
          contextResolutionReason: 'shopping_product_info_continuation',
        }),
        intentPlan: expect.objectContaining({
          primaryIntent: AssistantIntent.PRODUCT_ADVICE,
          contextualUserText: expect.stringContaining(
            'laptop gaming dưới 25 triệu',
          ),
        }),
      }),
    );
    expect(config.configurable.handlers.unsupported).not.toHaveBeenCalled();
    expect(result.routeTrace).toEqual([
      'supervisor',
      'sales',
      'product_advice',
      'merge_response',
    ]);
  });
  it('routes shopping constraint continuations with prior product context', async () => {
    const config = createGraphConfig();
    config.configurable.classifier.classify.mockResolvedValue({
      route: 'general',
      intents: [AssistantIntent.UNSUPPORTED],
      confidence: 0.4,
      entities: {},
      fallbackReason: 'unsupported_scope',
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        userText:
          'Ngân sách 25 triệu, dùng để học machine learning/AI, ưu tiên hiệu năng',
        promptContext: {
          sections: [
            {
              kind: 'hotMessages',
              content: [
                'customer: mình cần tư vấn laptop',
                'assistant: Bạn dự kiến ngân sách khoảng bao nhiêu? Bạn dùng chính để học/làm việc, chơi game, đồ họa hay di chuyển nhiều?',
              ].join('\n'),
            },
          ],
        },
      },
      config,
    );

    expect(config.configurable.handlers.productAdvice).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedEntities: expect.objectContaining({
          productCategory: 'laptop',
          contextualUserText: expect.stringContaining('laptop'),
          contextResolutionReason: 'shopping_constraint_continuation',
        }),
        intentPlan: expect.objectContaining({
          contextualUserText: expect.stringContaining('laptop'),
        }),
      }),
    );
    expect(config.configurable.handlers.unsupported).not.toHaveBeenCalled();
    expect(result.routeTrace).toEqual([
      'supervisor',
      'sales',
      'product_advice',
      'merge_response',
    ]);
  });

  it('keeps laptop context when a budget correction follows RTX/GPU assistant text', async () => {
    const config = createGraphConfig();
    config.configurable.classifier.classify.mockResolvedValue({
      route: 'general',
      intents: [AssistantIntent.UNSUPPORTED],
      confidence: 0.4,
      entities: {},
      fallbackReason: 'unsupported_scope',
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        userText: 'mình có tối đa 25 triệu thôi, tìm cho mình',
        promptContext: {
          sections: [
            {
              kind: 'hotMessages',
              content: [
                'customer: mình cần tư vấn laptop',
                'assistant: Bạn dự kiến ngân sách khoảng bao nhiêu?',
                'customer: tầm 25 triệu, nhu cầu học AI/Machine Learning',
                'assistant: Mình gợi ý các mẫu có RTX/GPU rời cho AI.',
              ].join('\n'),
            },
          ],
        },
      },
      config,
    );

    expect(config.configurable.handlers.productAdvice).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedEntities: expect.objectContaining({
          productCategory: 'laptop',
          contextualUserText: expect.stringContaining('laptop'),
          contextResolutionReason: 'shopping_constraint_continuation',
        }),
        intentPlan: expect.objectContaining({
          contextualUserText: expect.stringContaining('laptop'),
        }),
      }),
    );
    expect(config.configurable.handlers.productAdvice).not.toHaveBeenCalledWith(
      expect.objectContaining({
        parsedEntities: expect.objectContaining({ productCategory: 'vga' }),
      }),
    );
    expect(config.configurable.handlers.unsupported).not.toHaveBeenCalled();
    expect(result.routeTrace).toEqual([
      'supervisor',
      'sales',
      'product_advice',
      'merge_response',
    ]);
  });

  it('resolves non-laptop product follow-up constraints from recent conversation', async () => {
    const config = createGraphConfig();
    config.configurable.classifier.classify.mockResolvedValue({
      route: 'general',
      intents: [AssistantIntent.UNSUPPORTED],
      confidence: 0.4,
      entities: {},
      fallbackReason: 'unsupported_scope',
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        userText: '20 triệu được không?',
        promptContext: {
          sections: [
            {
              kind: 'hotMessages',
              content: [
                'customer: mình cần tư vấn màn hình chơi game',
                'assistant: Bạn dự kiến ngân sách khoảng bao nhiêu?',
              ].join('\n'),
            },
          ],
        },
      },
      config,
    );

    expect(config.configurable.handlers.productAdvice).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedEntities: expect.objectContaining({
          productCategory: 'màn hình',
          contextualUserText: expect.stringContaining('màn hình'),
          contextResolutionReason: 'shopping_constraint_continuation',
        }),
      }),
    );
    expect(config.configurable.handlers.unsupported).not.toHaveBeenCalled();
    expect(result.routeTrace).toEqual([
      'supervisor',
      'sales',
      'product_advice',
      'merge_response',
    ]);
  });

  it('uses the prior shopping request for terse affirmative continuations', async () => {
    const config = createGraphConfig();
    config.configurable.classifier.classify.mockResolvedValue({
      route: 'general',
      intents: [AssistantIntent.UNSUPPORTED],
      confidence: 0.4,
      entities: {},
      fallbackReason: 'unsupported_scope',
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        userText: 'có',
        promptContext: {
          sections: [
            {
              kind: 'hotMessages',
              content: [
                'customer: Mình cần tư vấn laptop dưới 25 triệu để học AI/Machine Learning, ưu tiên hiệu năng',
                'assistant: Mình gợi ý ưu tiên Lenovo IdeaPad Slim 5 OLED.',
                'customer: có',
              ].join('\n'),
            },
          ],
        },
      },
      config,
    );

    expect(config.configurable.handlers.productAdvice).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedEntities: expect.objectContaining({
          productCategory: 'laptop',
          contextualUserText: expect.stringContaining('Machine Learning'),
          contextResolutionReason: 'shopping_affirmation_continuation',
        }),
        intentPlan: expect.objectContaining({
          contextualUserText: expect.stringContaining('Machine Learning'),
        }),
      }),
    );
    expect(config.configurable.handlers.productAdvice).not.toHaveBeenCalledWith(
      expect.objectContaining({
        intentPlan: expect.objectContaining({
          contextualUserText: 'laptop có',
        }),
      }),
    );
    expect(config.configurable.handlers.unsupported).not.toHaveBeenCalled();
    expect(result.routeTrace).toEqual([
      'supervisor',
      'sales',
      'product_advice',
      'merge_response',
    ]);
  });

  it('routes recommendation-reference selection to a cart confirmation draft', async () => {
    const config = createGraphConfig();
    config.configurable.classifier.classify.mockResolvedValue({
      route: 'general',
      intents: [AssistantIntent.UNSUPPORTED],
      confidence: 0.4,
      entities: {},
      fallbackReason: 'unsupported_scope',
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        userText: 'mình muốn lấy cái thứ 2',
      },
      config,
    );

    expect(config.configurable.handlers.cartAction).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedEntities: expect.objectContaining({
          cartAction: 'CART_ADD',
          recommendationReference: expect.stringMatching(/cái thứ 2/i),
        }),
      }),
    );
    expect(config.configurable.handlers.unsupported).not.toHaveBeenCalled();
    expect(result.routeTrace).toEqual([
      'supervisor',
      'order',
      'cart_action',
      'merge_response',
    ]);
  });

  it('asks clarification for ambiguous ASUS/MSI cart follow-ups before any cart draft', async () => {
    const config = createGraphConfig();
    const candidates = [
      { productId: 'asus-tuf-a15', name: 'Laptop ASUS TUF Gaming A15' },
      { productId: 'msi-cyborg-15', name: 'Laptop MSI Cyborg 15' },
    ];
    config.configurable.classifier.classify.mockResolvedValue({
      route: 'order',
      intents: [AssistantIntent.CART_ACTION],
      confidence: 0.94,
      entities: { cartAction: 'CART_ADD' },
    });
    config.configurable.handlers.productContextResolver.mockResolvedValueOnce({
      status: 'clarification_required',
      matchSource: 'clarification',
      confidence: 0.7,
      candidates,
      clarification: {
        reason: 'ambiguous_product_reference',
        text: 'Mình thấy vài sản phẩm gần giống nhau: Laptop ASUS TUF Gaming A15, Laptop MSI Cyborg 15. Bạn muốn hỏi mẫu nào?',
        candidates,
      },
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-hotfix-ambiguous-cart',
        customerId: 'customer-a',
        userText: 'con ASUS TUF hoặc mẫu MSI ở trên thêm vào giỏ được không?',
        promptContext: {
          sections: [
            {
              kind: 'hotMessages',
              content: [
                'assistant: Laptop ASUS TUF Gaming A15; Laptop ASUS TUF Gaming F15',
                'assistant: Laptop MSI Cyborg 15; Laptop MSI Katana 15',
              ].join('\n'),
            },
          ],
        },
      },
      config,
    );

    expect(
      config.configurable.handlers.productContextResolver,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedEntities: expect.objectContaining({
          pendingCartAction: 'CART_ADD',
          requiresProductSelection: true,
        }),
      }),
    );
    expect(config.configurable.handlers.cartAction).not.toHaveBeenCalled();
    expect(result.routeTrace).toEqual([
      'supervisor',
      'sales',
      'product_context_resolver',
      'product_context_clarification',
      'merge_response',
    ]);
    expect(result.text).toContain('Bạn muốn hỏi mẫu nào');
    expect(result.actionDrafts).toEqual([]);
    expect(result.metadata?.deterministic_bypass).not.toBe(true);
    expect(result.metadata?.productContext).toMatchObject({
      status: 'clarification_required',
      clarification: expect.objectContaining({
        reason: 'ambiguous_product_reference',
      }),
    });
  });
  it('supports a realistic consultation journey across terse follow-up, recommendation, cart, and checkout', async () => {
    const config = createGraphConfig();
    config.configurable.classifier.classify.mockResolvedValue({
      route: 'general',
      intents: [AssistantIntent.UNSUPPORTED],
      confidence: 0.4,
      entities: {},
      fallbackReason: 'unsupported_scope',
    });
    config.configurable.handlers.productAdvice.mockImplementation(
      async (state) => ({
        intent: AssistantIntent.PRODUCT_ADVICE,
        nodeName: 'product_advice',
        text: state.intentPlan?.broadNeed
          ? 'Bạn cho mình ngân sách, mục đích sử dụng và ưu tiên chính nhé.'
          : 'Mình gợi ý Laptop Alpha vì khớp ngân sách và nhu cầu học AI.',
        metadata: state.intentPlan?.broadNeed
          ? {
              productCards: [],
              needsClarification: true,
              followUpQuestions: ['Ngân sách bao nhiêu?', 'Dùng chính làm gì?'],
            }
          : {
              productCards: [
                {
                  productId: 'p1',
                  name: 'Laptop Alpha RTX 4060',
                  price: 24_990_000,
                  stock: 3,
                },
              ],
            },
      }),
    );
    config.configurable.handlers.cartAction.mockResolvedValue({
      intent: AssistantIntent.CART_ACTION,
      nodeName: 'cart_action',
      text: 'Mình đã chuẩn bị thao tác thêm Laptop Alpha vào giỏ, bạn xác nhận nhé.',
      draft: {
        draftId: 'draft-p1',
        roomId: 'room-client-a',
        customerId: 'customer-a',
        kind: 'CART_ADD',
        productId: 'p1',
        requiresConfirmation: true,
      },
    });
    config.configurable.handlers.checkoutPrep.mockResolvedValue({
      intent: AssistantIntent.CHECKOUT_PREP,
      nodeName: 'checkout_prep',
      text: 'Bạn kiểm tra lại thông tin giao hàng trước khi mình chuyển sang thanh toán.',
      metadata: {
        checkoutReview: {
          name: 'Nguyen Van A',
          phoneMasked: '090****000',
          addressPreview: 'Quan 1, TP HCM',
          missingFields: [],
          actions: ['Đúng rồi', 'Chỉnh sửa'],
        },
      },
    });

    const broadNeed = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        customerId: 'customer-a',
        userText: 'mình cần tư vấn laptop',
      },
      config,
    );
    expect(config.configurable.handlers.productAdvice).toHaveBeenLastCalledWith(
      expect.objectContaining({
        intentPlan: expect.objectContaining({ broadNeed: true }),
      }),
    );
    expect(broadNeed.metadata?.productCards ?? []).toEqual([]);

    const recommendation = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        customerId: 'customer-a',
        userText: '25 triệu, học machine learning, ưu tiên hiệu năng',
        promptContext: {
          sections: [
            {
              kind: 'hotMessages',
              content: [
                'customer: mình cần tư vấn laptop',
                'assistant: Bạn cho mình ngân sách, mục đích sử dụng và ưu tiên chính nhé.',
              ].join('\n'),
            },
          ],
        },
      },
      config,
    );
    expect(config.configurable.handlers.productAdvice).toHaveBeenLastCalledWith(
      expect.objectContaining({
        parsedEntities: expect.objectContaining({
          productCategory: 'laptop',
          contextResolutionReason: 'shopping_constraint_continuation',
        }),
      }),
    );
    expect(recommendation.metadata?.productCards).toEqual([
      expect.objectContaining({
        productId: 'p1',
        name: 'Laptop Alpha RTX 4060',
      }),
    ]);

    const cart = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        customerId: 'customer-a',
        userText: 'mình lấy cái thứ 1',
      },
      config,
    );
    expect(config.configurable.handlers.cartAction).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedEntities: expect.objectContaining({
          cartAction: 'CART_ADD',
          recommendationReference: expect.stringMatching(/cái thứ 1/i),
        }),
      }),
    );
    expect(cart.actionDrafts).toEqual([
      expect.objectContaining({ draftId: 'draft-p1', kind: 'CART_ADD' }),
    ]);

    const checkout = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        customerId: 'customer-a',
        userText: 'có voucher nào dùng được không, chuẩn bị checkout giúp mình',
      },
      config,
    );
    expect(config.configurable.handlers.checkoutPrep).toHaveBeenCalledTimes(1);
    expect(checkout.routeTrace).toEqual([
      'supervisor',
      'order',
      'checkout_prep',
      'merge_response',
    ]);
    expect(checkout.metadata?.checkoutReview).toMatchObject({
      actions: ['Đúng rồi', 'Chỉnh sửa'],
    });
  });

  it('pauses completely in staff mode without invoking classifier, model, or retrieval', async () => {
    const config = createGraphConfig();

    await expect(
      shoppingAssistantGraph.invoke(
        {
          mode: AssistantMode.STAFF,
          roomId: 'room-client-a',
          userText: 'Toi dang noi voi nhan vien',
        },
        config,
      ),
    ).resolves.toMatchObject({
      status: 'staff_mode_paused',
      routeTrace: [],
    });

    expect(config.configurable.classifier.classify).not.toHaveBeenCalled();
    expect(config.configurable.model.invoke).not.toHaveBeenCalled();
    expect(config.configurable.retrieval.search).not.toHaveBeenCalled();
    Object.values(config.configurable.handlers).forEach((handler) => {
      expect(handler).not.toHaveBeenCalled();
    });
  });

  it('splits multi-intent plans and only parallelizes read-only safe pairs', async () => {
    expect(
      routeAfterClassification({
        primaryIntent: AssistantIntent.PRODUCT_ADVICE,
        intents: [
          AssistantIntent.PRODUCT_ADVICE,
          AssistantIntent.REVIEW_SUMMARY,
        ],
      }),
    ).toEqual({
      nodeName: 'split_intents',
      executionMode: 'parallel',
      orderedIntents: [
        AssistantIntent.PRODUCT_ADVICE,
        AssistantIntent.REVIEW_SUMMARY,
      ],
    });

    for (const unsafeIntent of [
      AssistantIntent.CART_ACTION,
      AssistantIntent.CHECKOUT_PREP,
      AssistantIntent.STAFF_HANDOFF,
    ]) {
      expect(
        routeAfterClassification({
          primaryIntent: AssistantIntent.PRODUCT_ADVICE,
          intents: [AssistantIntent.PRODUCT_ADVICE, unsafeIntent],
        }),
      ).toEqual({
        nodeName: 'split_intents',
        executionMode: 'sequential',
        orderedIntents: [AssistantIntent.PRODUCT_ADVICE, unsafeIntent],
      });
    }
  });

  it('runs every sales intent even when the intents share one subgraph', async () => {
    const config = createGraphConfig();
    config.configurable.classifier.classify.mockResolvedValue({
      route: 'sales',
      intents: [AssistantIntent.PRODUCT_ADVICE, AssistantIntent.REVIEW_SUMMARY],
      confidence: 0.95,
    });
    config.configurable.handlers.productAdvice.mockResolvedValue({
      intent: AssistantIntent.PRODUCT_ADVICE,
      nodeName: 'product_advice',
      text: 'San pham phu hop.',
      metadata: { productCards: [{ productId: 'p1', name: 'Laptop Alpha' }] },
    });
    config.configurable.handlers.reviewSummary.mockResolvedValue({
      intent: AssistantIntent.REVIEW_SUMMARY,
      nodeName: 'review_summary',
      text: 'Tom tat danh gia san pham.',
      metadata: { reviewSummary: { productId: 'p1', heading: 'Danh gia' } },
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        userText: 'Tu van laptop va tom tat danh gia',
      },
      config,
    );

    expect(config.configurable.handlers.productAdvice).toHaveBeenCalledTimes(1);
    expect(config.configurable.handlers.reviewSummary).toHaveBeenCalledTimes(1);
    expect(result.routeTrace).toEqual([
      'supervisor',
      'multi_route',
      'sales',
      'product_advice',
      'sales',
      'review_summary',
      'merge_response',
    ]);
    expect(result.metadata?.productCards).toEqual([
      { productId: 'p1', name: 'Laptop Alpha' },
    ]);
    expect(result.metadata?.reviewSummary).toEqual({
      productId: 'p1',
      heading: 'Danh gia',
    });
  });

  it('runs every order intent and carries action drafts into final metadata', async () => {
    const config = createGraphConfig();
    const createdAt = new Date('2026-05-09T00:00:00.000Z');
    const expiresAt = new Date('2026-05-09T00:15:00.000Z');
    const cartDraft = {
      draftId: 'draft-cart',
      roomId: 'room-client-a',
      customerId: 'customer-a',
      kind: 'CART_ADD',
      displayText: 'Them Laptop Alpha vao gio hang',
      payload: { productId: 'p1', quantity: 1 },
      requiresConfirmation: true,
      createdAt,
      expiresAt,
    };
    const checkoutDraft = {
      draftId: 'draft-checkout',
      roomId: 'room-client-a',
      customerId: 'customer-a',
      kind: 'CHECKOUT_REDIRECT',
      displayText: 'Xac nhan thong tin thanh toan',
      payload: {
        checkout: {
          name: 'Nguyen Van A',
          phone: '0900000000',
          address: '1 Nguyen Trai',
        },
      },
      checkout: {
        name: 'Nguyen Van A',
        phone: '0900000000',
        address: '1 Nguyen Trai',
      },
      requiresConfirmation: true,
      createdAt,
      expiresAt,
    };
    config.configurable.classifier.classify.mockResolvedValue({
      route: 'order',
      intents: [AssistantIntent.CART_ACTION, AssistantIntent.CHECKOUT_PREP],
      confidence: 0.95,
    });
    config.configurable.handlers.cartAction.mockResolvedValue({
      intent: AssistantIntent.CART_ACTION,
      nodeName: 'cart_action',
      text: 'Da chuan bi thao tac gio hang.',
      draft: cartDraft,
    });
    config.configurable.handlers.checkoutPrep.mockResolvedValue({
      intent: AssistantIntent.CHECKOUT_PREP,
      nodeName: 'checkout_prep',
      text: 'Da chuan bi buoc thanh toan.',
      draft: checkoutDraft,
      metadata: {
        checkoutReview: { missingFields: [], actions: ['confirm'] },
      },
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        customerId: 'customer-a',
        userText: 'Them san pham vao gio va chuan bi thanh toan',
      },
      config,
    );

    expect(config.configurable.handlers.cartAction).toHaveBeenCalledTimes(1);
    expect(config.configurable.handlers.checkoutPrep).toHaveBeenCalledTimes(1);
    expect(result.routeTrace).toEqual([
      'supervisor',
      'multi_route',
      'order',
      'cart_action',
      'order',
      'checkout_prep',
      'merge_response',
    ]);
    expect(result.actionDrafts).toEqual([cartDraft, checkoutDraft]);
    expect(result.metadata?.actionDrafts).toEqual([cartDraft, checkoutDraft]);
    expect(result.metadata?.checkoutReview).toEqual({
      missingFields: [],
      actions: ['confirm'],
    });
  });

  it('deduplicates repeated action intents before invoking order subgraph', async () => {
    const config = createGraphConfig();
    const cartDraft = {
      draftId: 'draft-cart-once',
      roomId: 'room-client-a',
      customerId: 'customer-a',
      kind: 'CART_ADD',
      displayText: 'Them Laptop Alpha vao gio hang',
      payload: { productId: 'p1', quantity: 1 },
      requiresConfirmation: true,
      createdAt: new Date('2026-05-09T00:00:00.000Z'),
      expiresAt: new Date('2026-05-09T00:15:00.000Z'),
    };
    config.configurable.classifier.classify.mockResolvedValue({
      route: 'order',
      intents: [AssistantIntent.CART_ACTION, AssistantIntent.CART_ACTION],
      confidence: 0.95,
    });
    config.configurable.handlers.cartAction.mockResolvedValue({
      intent: AssistantIntent.CART_ACTION,
      nodeName: 'cart_action',
      text: 'Da chuan bi thao tac gio hang.',
      draft: cartDraft,
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-client-a',
        customerId: 'customer-a',
        userText: 'Them san pham vao gio hang',
      },
      config,
    );

    expect(config.configurable.handlers.cartAction).toHaveBeenCalledTimes(1);
    expect(result.routeTrace).toEqual([
      'supervisor',
      'order',
      'cart_action',
      'merge_response',
    ]);
    expect(result.actionDrafts).toEqual([cartDraft]);
    expect(result.metadata?.actionDrafts).toEqual([cartDraft]);
  });

  it('merges action state before product advice, supporting information, and fallback', () => {
    const merged = mergeAssistantResponses([
      {
        intent: AssistantIntent.UNSUPPORTED,
        nodeName: 'unsupported',
        text: 'fallback',
      },
      {
        intent: AssistantIntent.REVIEW_SUMMARY,
        nodeName: 'review_summary',
        text: 'review and policy information',
      },
      {
        intent: AssistantIntent.PRODUCT_ADVICE,
        nodeName: 'product_advice',
        text: 'product advice',
      },
      {
        intent: AssistantIntent.CART_ACTION,
        nodeName: 'cart_action',
        text: 'pending cart action',
      },
    ]);

    expect(merged.orderedNodeNames).toEqual([
      'cart_action',
      'product_advice',
      'review_summary',
      'unsupported',
    ]);
    expect(merged.text).toMatch(
      /pending cart action[\s\S]*product advice[\s\S]*review and policy information[\s\S]*fallback/,
    );
  });

  it('routes catalog-detail follow-up through product_context_resolver and product_detail before merge_response', async () => {
    const config = createGraphConfig();
    config.configurable.handlers.productContextResolver.mockResolvedValueOnce({
      status: 'resolved',
      matchSource: 'ledger.rank',
      confidence: 0.99,
      product: {
        productId: 'asus-tuf-a15-fa506ncg-hn184w',
        name: 'Laptop ASUS TUF Gaming A15 FA506NCG-HN184W',
        rank: 2,
        createdAt: new Date('2026-05-12T00:00:00.000Z'),
      },
    });
    config.configurable.handlers.productDetail.mockResolvedValueOnce({
      intent: AssistantIntent.REVIEW_SUMMARY,
      nodeName: 'product_detail',
      text: 'Chi tiết catalog của sản phẩm vừa recommend.',
      metadata: {
        productIds: ['asus-tuf-a15-fa506ncg-hn184w'],
      },
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-hotfix-graph',
        userText: 'review chi tiết sản phẩm vừa recommend',
        promptContext: {
          sections: [
            {
              kind: 'hotMessages',
              content:
                'assistant: 1. Lenovo ThinkBook\\n2. Laptop ASUS TUF Gaming A15 FA506NCG-HN184W',
            },
          ],
        },
      },
      config,
    );

    expect(result.routeTrace).toEqual(
      expect.arrayContaining([
        'supervisor',
        'sales',
        'product_context_resolver',
        'product_detail',
        'merge_response',
      ]),
    );
    expect(result.routeTrace.join('>')).toMatch(
      /product_context_resolver.*product_detail/,
    );
  });

  it('routes explicit public-source detail through resolver before public_review and review_summary', async () => {
    const config = createGraphConfig();
    config.configurable.handlers.productContextResolver.mockResolvedValueOnce({
      status: 'resolved',
      matchSource: 'ledger.fuzzy_name',
      confidence: 0.9,
      product: {
        productId: 'asus-tuf-a15-fa506ncg-hn184w',
        name: 'Laptop ASUS TUF Gaming A15 FA506NCG-HN184W',
        rank: 1,
        createdAt: new Date('2026-05-12T00:00:00.000Z'),
      },
    });
    config.configurable.handlers.productDetail.mockResolvedValueOnce({
      intent: AssistantIntent.REVIEW_SUMMARY,
      nodeName: 'product_detail',
      text: 'Chi tiết catalog trước khi lấy nguồn công khai.',
      metadata: {
        productIds: ['asus-tuf-a15-fa506ncg-hn184w'],
      },
    });
    config.configurable.handlers.reviewSummary.mockResolvedValueOnce({
      intent: AssistantIntent.REVIEW_SUMMARY,
      nodeName: 'review_summary',
      text: 'Nguồn công khai có tín hiệu cần kiểm chứng.',
      metadata: {
        reviewSummary: { citations: [{ url: 'https://example.test/review' }] },
      },
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'room-hotfix-graph',
        userText:
          'review chi tiết mẫu vừa tư vấn, sau đó cho mình nguồn công khai trên mạng nói gì về mẫu này',
        promptContext: {
          sections: [
            {
              kind: 'hotMessages',
              content: 'assistant: Laptop ASUS TUF Gaming A15 FA506NCG-HN184W',
            },
          ],
        },
      },
      config,
    );

    expect(result.routeTrace).toEqual(
      expect.arrayContaining([
        'product_context_resolver',
        'product_detail',
        'public_review',
        'review_summary',
      ]),
    );
    expect(result.routeTrace.join('>')).toMatch(
      /product_context_resolver.*product_detail.*public_review.*review_summary/,
    );
    expect(config.configurable.handlers.productDetail).toHaveBeenCalledTimes(1);
    expect(config.configurable.handlers.reviewSummary).toHaveBeenCalledTimes(1);
    expect(
      config.configurable.handlers.productDetail.mock.invocationCallOrder[0],
    ).toBeLessThan(
      config.configurable.handlers.reviewSummary.mock.invocationCallOrder[0],
    );
  });
});
