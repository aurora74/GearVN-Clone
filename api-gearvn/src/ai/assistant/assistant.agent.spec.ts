import { AssistantIntent, AssistantMode } from './assistant.types';
import { shoppingAssistantGraph } from './shopping-assistant.graph';
import { PHASE_09_1_UAT_PROMPTS } from './assistant-uat.fixtures';
import { OrderToolsService } from './tools/order-tools.service';

const EXPECTED_AGENT_COMPONENTS = [
  'Supervisor Agent',
  'Sales Subgraph',
  'Order Subgraph',
  'General Agent',
] as const;

const EXPECTED_GRAPH_NODE_NAMES = [
  'supervisor',
  'sales',
  'order',
  'general',
  'merge_response',
] as const;

const REQUIRED_TRACE_FIELDS = [
  'supervisor_decision',
  'active_subgraph',
  'model_name',
  'latency_ms',
  'guardrail_decision',
  'response_merge',
] as const;

const SCENARIO_TRACE_FIELD: Record<(typeof PHASE_09_1_UAT_PROMPTS)[number], string> = {
  'chào bạn': 'fallback_reason',
  'mình cần laptop học AI tầm 25 triệu': 'tool_calls',
  'ok thêm cái thứ 2 vào giỏ': 'tool_calls',
  'đổi sang cái rẻ hơn còn hàng': 'tool_calls',
  'mình tên A, sđt B, địa chỉ C, chuẩn bị checkout': 'tool_calls',
  'đơn hàng của tôi đang ở đâu': 'tool_calls',
  'laptop gaming RTX 4090 dưới 20 triệu': 'crag_retry',
  'nhớ mình thích laptop gì không?': 'memory_used',
};

const STAFF_ONLY_FIELD_PATTERN = /staff(summary|only)|internal(summary|note)|handoffsummary/i;

const VIETNAMESE_DIACRITIC_PATTERN =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

function graphNodeNames(): string[] {
  const graph = (
    shoppingAssistantGraph as unknown as {
      getGraph?: () => {
        nodes?: Record<string, unknown> | Array<{ id?: string; name?: string }>;
      };
    }
  ).getGraph?.();
  if (!graph?.nodes) return [];
  if (Array.isArray(graph.nodes)) {
    return graph.nodes
      .map((node) => node.id ?? node.name)
      .filter((name): name is string => Boolean(name));
  }
  return Object.keys(graph.nodes);
}

function graphConfigForPrompt(prompt: (typeof PHASE_09_1_UAT_PROMPTS)[number] | string) {
  const isGreeting = prompt === 'chào bạn';
  const isCartPrompt = prompt.includes('giỏ') || prompt.includes('rẻ hơn');
  const isCheckoutPrompt = prompt.includes('checkout');
  const isOrderLookupPrompt = prompt.includes('đơn hàng');
  const isMemoryPrompt = prompt.includes('nhớ mình thích');
  const isImpossibleRetrieval = prompt.includes('RTX 4090 dưới 20 triệu');
  const route = isGreeting ? 'general' : isCartPrompt || isCheckoutPrompt || isOrderLookupPrompt ? 'order' : 'sales';
  const intent = isGreeting
    ? AssistantIntent.UNSUPPORTED
    : isCartPrompt
      ? AssistantIntent.CART_ACTION
      : isCheckoutPrompt
        ? AssistantIntent.CHECKOUT_PREP
        : isOrderLookupPrompt
          ? AssistantIntent.ORDER_LOOKUP
          : AssistantIntent.PRODUCT_ADVICE;

  return {
    configurable: {
      classifier: {
        classify: jest.fn().mockResolvedValue({
          primaryIntent: intent,
          intents: [intent],
          route,
          memoryRefs: isMemoryPrompt ? ['laptop học AI'] : [],
        }),
      },
      promptContext: isMemoryPrompt
        ? {
            sections: [
              {
                kind: 'profileMemory',
                content: 'Sở thích đã lưu: laptop học AI, ưu tiên GPU NVIDIA.',
              },
            ],
          }
        : undefined,
      handlers: {
        productAdvice: jest.fn().mockImplementation(() => ({
          intent: AssistantIntent.PRODUCT_ADVICE,
          nodeName: 'sales',
          text: isMemoryPrompt
            ? 'Mình nhớ bạn thích laptop học AI và ưu tiên GPU NVIDIA.'
            : isImpossibleRetrieval
              ? 'Mình chưa thấy laptop gaming RTX 4090 dưới 20 triệu, nên mình đã thử nới điều kiện để gợi ý lựa chọn phù hợp hơn.'
              : 'Mình sẽ tư vấn laptop học AI dựa trên dữ liệu sản phẩm GearVN.',
          metadata: {
            tool_calls: [{ toolName: 'search_products', subgraph: 'sales', status: 'success' }],
            retrieval_query: prompt,
            ...(isImpossibleRetrieval
              ? { crag_retry: { attempted: true, reason: 'impossible_budget_gpu_constraint' } }
              : {}),
            ...(isMemoryPrompt ? { memory_used: true } : {}),
          },
        })),
        cartAction: jest.fn().mockResolvedValue({
          intent: AssistantIntent.CART_ACTION,
          nodeName: 'order',
          text: prompt.includes('rẻ hơn')
            ? 'Mình sẽ tìm lựa chọn rẻ hơn còn hàng để bạn xác nhận trước khi thêm vào giỏ.'
            : 'Mình đã chuẩn bị thao tác thêm sản phẩm vào giỏ và cần bạn xác nhận.',
          metadata: {
            tool_calls: [{ toolName: 'create_cart_action_draft', subgraph: 'order', status: 'success' }],
          },
        }),
        checkoutPrep: jest.fn().mockResolvedValue({
          intent: AssistantIntent.CHECKOUT_PREP,
          nodeName: 'order',
          text: 'Mình đã chuẩn bị thông tin checkout và sẽ để bạn kiểm tra trước khi chuyển sang thanh toán.',
          metadata: {
            tool_calls: [{ toolName: 'prepare_checkout_review', subgraph: 'order', status: 'success' }],
          },
        }),
        orderLookup: jest.fn().mockResolvedValue({
          intent: AssistantIntent.ORDER_LOOKUP,
          nodeName: 'order',
          text: 'Mình cần xác minh đơn hàng thuộc đúng tài khoản của bạn.',
          metadata: {
            tool_calls: [{ toolName: 'owned_order_lookup', subgraph: 'order', status: 'success' }],
          },
        }),
        unsupported: jest.fn().mockResolvedValue({
          intent: AssistantIntent.UNSUPPORTED,
          nodeName: 'general',
          text: isGreeting
            ? 'Chào bạn, mình là trợ lý GearVN và có thể hỗ trợ chọn sản phẩm, giỏ hàng hoặc đơn hàng.'
            : 'Mình chưa hỗ trợ yêu cầu này trong phạm vi mua sắm GearVN.',
          metadata: {
            fallback_reason: isGreeting ? 'greeting_guidance' : 'unsupported_scope',
          },
        }),
      },
    },
  };
}

function traceEvidence(result: { metadata?: Record<string, unknown>; traceEvents?: Record<string, unknown>[] }) {
  return (result.traceEvents ?? []).reduce<Record<string, unknown>>(
    (merged, event) => {
      for (const [key, value] of Object.entries(event)) {
        if (value !== undefined) merged[key] = value;
      }
      return merged;
    },
    { ...(result.metadata ?? {}) },
  );
}

function expectNoStaffOnlyFields(value: unknown) {
  const serialized = JSON.stringify(value ?? {});
  expect(serialized).not.toMatch(STAFF_ONLY_FIELD_PATTERN);
}

function expectAccentedCustomerText(text: string) {
  expect(text).toEqual(expect.any(String));
  expect(VIETNAMESE_DIACRITIC_PATTERN.test(text)).toBe(true);
}

describe('Phase 09.1 assistant agent contract', () => {
  it('locks exactly eight accented Vietnamese UAT prompts', () => {
    expect(PHASE_09_1_UAT_PROMPTS).toEqual([
      'chào bạn',
      'mình cần laptop học AI tầm 25 triệu',
      'ok thêm cái thứ 2 vào giỏ',
      'đổi sang cái rẻ hơn còn hàng',
      'mình tên A, sđt B, địa chỉ C, chuẩn bị checkout',
      'đơn hàng của tôi đang ở đâu',
      'laptop gaming RTX 4090 dưới 20 triệu',
      'nhớ mình thích laptop gì không?',
    ]);
    expect(PHASE_09_1_UAT_PROMPTS).toHaveLength(8);
    expect(PHASE_09_1_UAT_PROMPTS.every((prompt) => VIETNAMESE_DIACRITIC_PATTERN.test(prompt))).toBe(
      true,
    );
  });

  it('exposes the mandatory Supervisor Agent topology', () => {
    expect(EXPECTED_AGENT_COMPONENTS).toEqual([
      'Supervisor Agent',
      'Sales Subgraph',
      'Order Subgraph',
      'General Agent',
    ]);
    expect(graphNodeNames()).toEqual(
      expect.arrayContaining([...EXPECTED_GRAPH_NODE_NAMES]),
    );
  });

  it.each(PHASE_09_1_UAT_PROMPTS)(
    'routes "%s" through the LLM Supervisor with visible redacted UAT evidence',
    async (prompt) => {
      const result = await shoppingAssistantGraph.invoke(
        {
          mode: AssistantMode.AI,
          roomId: 'phase-09-1-contract-room',
          customerId: 'customer-1',
          authenticatedUserId: 'customer-1',
          userText: prompt,
          promptContext: graphConfigForPrompt(prompt).configurable.promptContext,
        },
        graphConfigForPrompt(prompt),
      );
      const evidence = traceEvidence(result);

      expect(result.routeTrace[0]).toBe('supervisor');
      expect(result.routeTrace).toContain('merge_response');
      expectAccentedCustomerText(result.text ?? '');
      expectNoStaffOnlyFields(result.text);
      expectNoStaffOnlyFields(result.metadata);
      for (const field of REQUIRED_TRACE_FIELDS) {
        expect(evidence).toHaveProperty(field);
      }
      expect(evidence).toEqual(
        expect.objectContaining({
          supervisor_decision: expect.any(Object),
          active_subgraph: expect.stringMatching(/sales|order|general/),
          model_name: expect.any(String),
          latency_ms: expect.any(Number),
          guardrail_decision: expect.any(Object),
        }),
      );
      expect(evidence).toHaveProperty(SCENARIO_TRACE_FIELD[prompt]);
    },
  );

  it('keeps a single subgraph response unchanged and does not call the merger LLM', async () => {
    const responseMergeModel = { invoke: jest.fn() };
    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'phase-09-1-single-merge-room',
        authenticatedUserId: 'customer-1',
        userText: 'mình cần laptop học AI tầm 25 triệu',
      },
      {
        configurable: {
          responseMergeModel,
          classifier: {
            classify: jest.fn().mockResolvedValue({
              primaryIntent: AssistantIntent.PRODUCT_ADVICE,
              intents: [AssistantIntent.PRODUCT_ADVICE],
              route: 'sales',
            }),
          },
          handlers: {
            productAdvice: jest.fn().mockResolvedValue({
              intent: AssistantIntent.PRODUCT_ADVICE,
              nodeName: 'product_advice',
              text: 'Mình sẽ tư vấn laptop học AI dựa trên dữ liệu GearVN.',
              metadata: { productCards: [{ productId: 'p1' }] },
            }),
          },
        },
      },
    );

    expect(responseMergeModel.invoke).not.toHaveBeenCalled();
    expect(result.text).toBe('Mình sẽ tư vấn laptop học AI dựa trên dữ liệu GearVN.');
    expect(result.metadata?.response_merge).toEqual(
      expect.objectContaining({
        mode: 'single_response_bypass',
        responseCount: 1,
      }),
    );
  });

  it('merges product and cart responses with accented Vietnamese trace metadata', async () => {
    const productCards = [{ productId: 'p1', name: 'Laptop Alpha' }];
    const actionDrafts = [{ draftId: 'draft-p1', kind: 'CART_ADD' }];
    const responseMergeModel = {
      invoke: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          finalMessage:
            'Mình đề xuất Laptop Alpha và đã chuẩn bị thao tác thêm vào giỏ để bạn xác nhận.',
          priorityOrder: ['product_advice', 'cart_action'],
          selectedResponseIds: ['product_advice', 'cart_action'],
          droppedDuplicateResponseIds: [],
          metadataPreserved: ['productCards', 'actionDrafts'],
          factSources: ['product_advice.productCards', 'cart_action.actionDrafts'],
          unsupportedReason: null,
          confidence: 0.92,
        }),
      }),
    };

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'phase-09-1-product-cart-merge-room',
        customerId: 'customer-1',
        authenticatedUserId: 'customer-1',
        userText: 'mình cần laptop học AI và thêm vào giỏ',
      },
      {
        configurable: {
          responseMergeModel,
          classifier: {
            classify: jest.fn().mockResolvedValue({
              primaryIntent: AssistantIntent.PRODUCT_ADVICE,
              intents: [AssistantIntent.PRODUCT_ADVICE, AssistantIntent.CART_ACTION],
              route: 'sales',
            }),
          },
          handlers: {
            productAdvice: jest.fn().mockResolvedValue({
              intent: AssistantIntent.PRODUCT_ADVICE,
              nodeName: 'product_advice',
              text: 'Laptop Alpha phù hợp nhu cầu học AI.',
              metadata: { productCards },
            }),
            cartAction: jest.fn().mockResolvedValue({
              intent: AssistantIntent.CART_ACTION,
              nodeName: 'cart_action',
              text: 'Mình đã chuẩn bị thao tác thêm vào giỏ.',
              metadata: { actionDrafts },
            }),
          },
        },
      },
    );

    expect(responseMergeModel.invoke).toHaveBeenCalledTimes(1);
    expect(result.text).toContain('đã chuẩn bị thao tác');
    expect(VIETNAMESE_DIACRITIC_PATTERN.test(result.text ?? '')).toBe(true);
    expect(result.metadata?.productCards).toEqual(productCards);
    expect(result.metadata?.actionDrafts).toEqual(actionDrafts);
    expect(result.metadata?.response_merge).toEqual(
      expect.objectContaining({
        mode: 'llm_planner_merge',
        responseCount: 2,
        selectedResponseIds: ['product_advice', 'cart_action'],
        droppedDuplicateResponseIds: [],
        modelName: expect.any(String),
        latencyMs: expect.any(Number),
      }),
    );
  });

  it('resolves cái thứ 2 through the recommendation ledger and creates a confirmed cart draft only', async () => {
    const orderToolsService = {
      resolveProductReference: jest.fn().mockResolvedValue({
        data: {
          rank: 2,
          productId: 'product-ledger-2',
          name: 'Laptop Beta',
          price: 23000000,
          stock: 5,
          createdAt: new Date('2026-05-09T08:00:00.000Z'),
        },
        toolCall: {
          toolName: 'resolve_recommendation_reference',
          subgraph: 'order',
          status: 'success',
        },
      }),
      createCartActionDraft: jest.fn().mockResolvedValue({
        data: {
          type: 'assistant_action_draft',
          draft: {
            draftId: 'draft-cart-ledger-2',
            roomId: 'phase-09-1-contract-room',
            customerId: 'customer-1',
            action: 'CART_ADD',
            kind: 'CART_ADD',
            requiresConfirmation: true,
            confirmedByBackend: false,
          },
        },
        toolCall: {
          toolName: 'create_cart_action_draft',
          subgraph: 'order',
          status: 'success',
        },
      }),
      mutateCart: jest.fn(),
    };

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'phase-09-1-contract-room',
        customerId: 'customer-1',
        authenticatedUserId: 'customer-1',
        userText: 'ok thêm cái thứ 2 vào giỏ',
        parsedEntities: {
          recommendationReference: 'cái thứ 2',
          quantity: 1,
        },
      },
      {
        configurable: {
          classifier: {
            classify: jest.fn().mockResolvedValue({
              primaryIntent: AssistantIntent.CART_ACTION,
              intents: [AssistantIntent.CART_ACTION],
              route: 'order',
            }),
          },
          orderToolsService,
        },
      },
    );

    expect(orderToolsService.resolveProductReference).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'phase-09-1-contract-room',
        userText: 'ok thêm cái thứ 2 vào giỏ',
      }),
    );
    expect(orderToolsService.createCartActionDraft).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ rank: 2, productId: 'product-ledger-2' }),
      1,
      'CART_ADD',
    );
    expect(result.actionDrafts[0]).toMatchObject({
      draftId: 'draft-cart-ledger-2',
      requiresConfirmation: true,
      confirmedByBackend: false,
    });
    expect(result.metadata?.tool_calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ toolName: 'resolve_recommendation_reference' }),
        expect.objectContaining({ toolName: 'create_cart_action_draft' }),
      ]),
    );
    expect(orderToolsService.mutateCart).not.toHaveBeenCalled();
  });

  it('extracts con thứ nhất as a recommendation reference instead of a product name', async () => {
    const orderToolsService = {
      resolveProductReference: jest.fn().mockResolvedValue({
        data: {
          rank: 1,
          productId: 'lenovo-thinkpad-e16-gen-3-21sr00aavn',
          name: 'Laptop Lenovo ThinkPad E16 Gen 3 21SR00AAVN',
          price: 23990000,
          stock: 4,
          createdAt: new Date('2026-05-09T08:00:00.000Z'),
        },
        toolCall: {
          toolName: 'resolve_recommendation_reference',
          subgraph: 'order',
          status: 'success',
        },
      }),
      createCartActionDraft: jest.fn().mockResolvedValue({
        data: {
          type: 'assistant_action_draft',
          draft: {
            draftId: 'draft-cart-thinkpad-e16',
            roomId: 'ordinal-reference-room',
            customerId: 'customer-1',
            action: 'CART_ADD',
            kind: 'CART_ADD',
            productId: 'lenovo-thinkpad-e16-gen-3-21sr00aavn',
            requiresConfirmation: true,
            confirmedByBackend: false,
          },
        },
        toolCall: {
          toolName: 'create_cart_action_draft',
          subgraph: 'order',
          status: 'success',
        },
      }),
    };

    await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'ordinal-reference-room',
        customerId: 'customer-1',
        authenticatedUserId: 'customer-1',
        userText: 'thêm cho mình con thứ nhất vào giỏ',
      },
      {
        configurable: {
          classifier: {
            classify: jest.fn().mockResolvedValue({
              primaryIntent: AssistantIntent.UNSUPPORTED,
              intents: [AssistantIntent.UNSUPPORTED],
              route: 'general',
              entities: {},
            }),
          },
          orderToolsService,
        },
      },
    );

    expect(orderToolsService.resolveProductReference).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedEntities: expect.objectContaining({
          cartAction: 'CART_ADD',
          recommendationReference: expect.stringContaining('thu nhat'),
        }),
      }),
    );
    expect(orderToolsService.resolveProductReference).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedEntities: expect.not.objectContaining({
          productName: 'thứ nhất',
        }),
      }),
    );
    expect(orderToolsService.createCartActionDraft).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        productId: 'lenovo-thinkpad-e16-gen-3-21sr00aavn',
      }),
      1,
      'CART_ADD',
    );
  });

  it('routes named product add requests to a confirmation draft instead of unsupported fallback', async () => {
    const orderToolsService = {
      resolveProductReference: jest.fn().mockResolvedValue({
        data: {
          id: 'product-lenovo-slim-5',
          name: 'Lenovo IdeaPad Slim 5 OLED 14AKP10 83HX001KVN',
          price: 22490000,
          stock: 6,
        },
        toolCall: {
          toolName: 'resolve_recommendation_reference',
          subgraph: 'order',
          status: 'success',
        },
      }),
      createCartActionDraft: jest.fn().mockResolvedValue({
        data: {
          type: 'assistant_action_draft',
          draft: {
            draftId: 'draft-cart-lenovo-slim-5',
            roomId: 'phase-09-1-product-name-room',
            customerId: 'customer-1',
            action: 'CART_ADD',
            kind: 'CART_ADD',
            requiresConfirmation: true,
            confirmedByBackend: false,
          },
        },
        toolCall: {
          toolName: 'create_cart_action_draft',
          subgraph: 'order',
          status: 'success',
        },
      }),
    };

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'phase-09-1-product-name-room',
        customerId: 'customer-1',
        authenticatedUserId: 'customer-1',
        userText:
          'lấy cho mình con Lenovo IdeaPad Slim 5 OLED 14AKP10 83HX001KVN',
      },
      {
        configurable: {
          classifier: {
            classify: jest.fn().mockResolvedValue({
              primaryIntent: AssistantIntent.UNSUPPORTED,
              intents: [AssistantIntent.UNSUPPORTED],
              route: 'general',
              entities: {},
            }),
          },
          orderToolsService,
        },
      },
    );

    expect(orderToolsService.resolveProductReference).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedEntities: expect.objectContaining({
          cartAction: 'CART_ADD',
          productName: 'Lenovo IdeaPad Slim 5 OLED 14AKP10 83HX001KVN',
        }),
      }),
    );
    expect(orderToolsService.createCartActionDraft).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ id: 'product-lenovo-slim-5' }),
      1,
      'CART_ADD',
    );
    expect(result.actionDrafts[0]).toMatchObject({
      draftId: 'draft-cart-lenovo-slim-5',
      requiresConfirmation: true,
      confirmedByBackend: false,
    });
    expect(result.routeTrace).toEqual([
      'supervisor',
      'order',
      'cart_action',
      'merge_response',
    ]);
  });

  it('resolves named product cart requests through catalog lookup when no ledger reference exists', async () => {
    const sessionService = {
      resolveRecommendationReference: jest.fn(),
      getOrCreateSession: jest.fn(),
    };
    const catalogAdapter = {
      searchProducts: jest.fn().mockResolvedValue({
        results: [
          {
            productId: '64f100000000000000000099',
            payload: { productId: '64f100000000000000000099' },
          },
        ],
      }),
      getSnapshotsByIds: jest.fn().mockResolvedValue([
        {
          productId: '64f100000000000000000099',
          name: 'Lenovo IdeaPad Slim 5 OLED 14AKP10 83HX001KVN',
          slug: 'lenovo-ideapad-slim-5-oled-14akp10-83hx001kvn',
          price: 24990000,
          discountPrice: 22490000,
          stock: 6,
          isPublished: true,
          isArchived: false,
        },
      ]),
    };
    const orderToolsService = new OrderToolsService(
      sessionService as any,
      undefined,
      undefined,
      undefined,
      undefined,
      catalogAdapter as any,
    );

    const result = await orderToolsService.resolveProductReference({
      roomId: 'phase-09-1-product-name-room',
      userText:
        'lấy cho mình con Lenovo IdeaPad Slim 5 OLED 14AKP10 83HX001KVN',
      parsedEntities: {
        productName: 'Lenovo IdeaPad Slim 5 OLED 14AKP10 83HX001KVN',
      },
    } as any);

    expect(catalogAdapter.searchProducts).toHaveBeenCalledWith(
      'Lenovo IdeaPad Slim 5 OLED 14AKP10 83HX001KVN',
      expect.objectContaining({ topK: 1 }),
    );
    expect(catalogAdapter.getSnapshotsByIds).toHaveBeenCalledWith([
      '64f100000000000000000099',
    ]);
    expect(result.data).toMatchObject({
      id: '64f100000000000000000099',
      name: 'Lenovo IdeaPad Slim 5 OLED 14AKP10 83HX001KVN',
      price: 22490000,
      stock: 6,
    });
    expect(result.toolCall).toMatchObject({
      status: 'success',
      inputSummary:
        'productName:Lenovo IdeaPad Slim 5 OLED 14AKP10 83HX001KVN',
      outputSummary: 'product:64f100000000000000000099',
    });
  });

  it('ignores cart-only productName entities and uses the focused ledger product', async () => {
    const sessionService = {
      resolveRecommendationReference: jest.fn(),
      getLastRecommendationLedger: jest.fn().mockResolvedValue([
        {
          rank: 1,
          productId: 'product-focused-lenovo',
          name: 'Laptop Lenovo IdeaPad Slim 3 15Q8X10 83N3002PVN',
          price: 21490000,
          stock: 10,
        },
      ]),
    };
    const catalogAdapter = {
      searchProducts: jest.fn(),
      getSnapshotsByIds: jest.fn(),
    };
    const orderToolsService = new OrderToolsService(
      sessionService as any,
      undefined,
      undefined,
      undefined,
      undefined,
      catalogAdapter as any,
    );

    const result = await orderToolsService.resolveProductReference({
      roomId: 'phase-09-1-focused-cart-room',
      userText: 'thêm vào giỏ cho mình',
      parsedEntities: {
        cartAction: 'CART_ADD',
        productName: 'vào giỏ cho mình',
      },
    } as any);

    expect(catalogAdapter.searchProducts).not.toHaveBeenCalled();
    expect(result.data).toMatchObject({
      productId: 'product-focused-lenovo',
      name: 'Laptop Lenovo IdeaPad Slim 3 15Q8X10 83N3002PVN',
    });
    expect(result.toolCall).toMatchObject({
      status: 'success',
      inputSummary: 'focused-ledger-selection',
      outputSummary: 'rank:1;product:product-focused-lenovo',
    });
  });

  it('uses rank 1 ledger product for con thứ nhất and never catalog-searches the ordinal text', async () => {
    const rankOneProduct = {
      rank: 1,
      productId: 'lenovo-thinkpad-e16-gen-3-21sr00aavn',
      name: 'Laptop Lenovo ThinkPad E16 Gen 3 21SR00AAVN',
      price: 23990000,
      stock: 4,
      createdAt: new Date('2026-05-09T08:00:00.000Z'),
    };
    const sessionService = {
      resolveRecommendationReference: jest.fn().mockResolvedValue(rankOneProduct),
      getLastRecommendationLedger: jest.fn(),
    };
    const catalogAdapter = {
      searchProducts: jest.fn(),
      getSnapshotsByIds: jest.fn(),
    };
    const orderToolsService = new OrderToolsService(
      sessionService as any,
      undefined,
      undefined,
      undefined,
      undefined,
      catalogAdapter as any,
    );

    const result = await orderToolsService.resolveProductReference({
      roomId: 'ordinal-order-tool-room',
      userText: 'thêm cho mình con thứ nhất vào giỏ',
      parsedEntities: {
        cartAction: 'CART_ADD',
        productName: 'thứ nhất',
      },
    } as any);

    expect(sessionService.resolveRecommendationReference).toHaveBeenCalledWith(
      'ordinal-order-tool-room',
      expect.stringContaining('thứ nhất'),
    );
    expect(catalogAdapter.searchProducts).not.toHaveBeenCalled();
    expect(result.data).toMatchObject({
      productId: 'lenovo-thinkpad-e16-gen-3-21sr00aavn',
      name: 'Laptop Lenovo ThinkPad E16 Gen 3 21SR00AAVN',
    });
  });

  it('does not catalog-search ordinal references when the recommendation ledger cannot resolve them', async () => {
    const sessionService = {
      resolveRecommendationReference: jest.fn().mockResolvedValue(null),
      getLastRecommendationLedger: jest.fn(),
    };
    const catalogAdapter = {
      searchProducts: jest.fn(),
      getSnapshotsByIds: jest.fn(),
    };
    const orderToolsService = new OrderToolsService(
      sessionService as any,
      undefined,
      undefined,
      undefined,
      undefined,
      catalogAdapter as any,
    );

    const result = await orderToolsService.resolveProductReference({
      roomId: 'unresolved-ordinal-order-tool-room',
      userText: 'thêm cái số 3 vào giỏ',
      parsedEntities: {
        cartAction: 'CART_ADD',
        productName: 'số 3',
      },
    } as any);

    expect(catalogAdapter.searchProducts).not.toHaveBeenCalled();
    expect(result.data).toBeNull();
    expect(result.toolCall).toMatchObject({ status: 'skipped' });
  });
  it('requires explicit quantity before service-backed set quantity drafts', async () => {
    const orderToolsService = {
      resolveProductReference: jest.fn().mockResolvedValue({
        data: {
          productId: 'product-ledger-2',
          name: 'Laptop Beta',
          price: 23000000,
          stock: 5,
        },
        toolCall: {
          toolName: 'resolve_recommendation_reference',
          subgraph: 'order',
          status: 'success',
        },
      }),
      createCartActionDraft: jest.fn(),
    };

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'phase-09-1-contract-room',
        customerId: 'customer-1',
        authenticatedUserId: 'customer-1',
        userText: 'cập nhật số lượng cái thứ 2',
      },
      {
        configurable: {
          classifier: {
            classify: jest.fn().mockResolvedValue({
              primaryIntent: AssistantIntent.CART_ACTION,
              intents: [AssistantIntent.CART_ACTION],
              route: 'order',
              entities: {
                cartAction: 'CART_SET_QUANTITY',
                recommendationReference: 'cái thứ 2',
              },
            }),
          },
          orderToolsService,
        },
      },
    );

    expect(orderToolsService.resolveProductReference).toHaveBeenCalled();
    expect(orderToolsService.createCartActionDraft).not.toHaveBeenCalled();
    expect(result.actionDrafts ?? []).toEqual([]);
    expect(traceEvidence(result).tool_calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolName: 'create_cart_action_draft',
          status: 'skipped',
          outputSummary: 'missing_quantity',
        }),
      ]),
    );
  });

  it.each([
    ['CART_ADD', null, 1],
    ['CART_REMOVE', 9, 0],
    ['CART_SET_QUANTITY', '3', 3],
  ] as const)(
    'normalizes service-backed %s quantity %p to %p',
    async (cartAction, quantity, expectedQuantity) => {
      const orderToolsService = {
        resolveProductReference: jest.fn().mockResolvedValue({
          data: {
            productId: 'product-ledger-2',
            name: 'Laptop Beta',
            price: 23000000,
            stock: 5,
          },
          toolCall: {
            toolName: 'resolve_recommendation_reference',
            subgraph: 'order',
            status: 'success',
          },
        }),
        createCartActionDraft: jest.fn().mockResolvedValue({
          data: {
            type: 'assistant_action_draft',
            draft: {
              draftId: `draft-${cartAction}`,
              roomId: 'phase-09-1-contract-room',
              customerId: 'customer-1',
              action: cartAction,
              kind: cartAction,
              quantity: expectedQuantity,
              requiresConfirmation: true,
              confirmedByBackend: false,
            },
          },
          toolCall: {
            toolName: 'create_cart_action_draft',
            subgraph: 'order',
            status: 'success',
          },
        }),
      };

      await shoppingAssistantGraph.invoke(
        {
          mode: AssistantMode.AI,
          roomId: 'phase-09-1-contract-room',
          customerId: 'customer-1',
          authenticatedUserId: 'customer-1',
          userText: 'cập nhật giỏ hàng',
        },
        {
          configurable: {
            classifier: {
              classify: jest.fn().mockResolvedValue({
                primaryIntent: AssistantIntent.CART_ACTION,
                intents: [AssistantIntent.CART_ACTION],
                route: 'order',
                entities: {
                  cartAction,
                  quantity,
                  recommendationReference: 'cái thứ 2',
                },
              }),
            },
            orderToolsService,
          },
        },
      );

      expect(orderToolsService.createCartActionDraft).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ productId: 'product-ledger-2' }),
        expectedQuantity,
        cartAction,
      );
    },
  );

  it('records fallback_reason when the Supervisor cannot safely route', async () => {
    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'phase-09-1-contract-room',
        authenticatedUserId: 'customer-1',
        userText: 'viết thơ về card đồ họa giúp mình',
      },
      graphConfigForPrompt('viết thơ về card đồ họa giúp mình'),
    );

    expect(result.metadata).toHaveProperty('fallback_reason');
    expect(result.metadata).toHaveProperty('guardrail_decision');
  });

  it('blocks direct order and payment requests with guardrail metadata', async () => {
    const actionAdapter = {
      createOrder: jest.fn(),
      createPayment: jest.fn(),
    };
    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'phase-09-1-contract-room',
        authenticatedUserId: 'customer-1',
        userText: 'tạo đơn và thanh toán luôn giúp mình',
      },
      {
        configurable: {
          classifier: {
            classify: jest.fn().mockResolvedValue({
              primaryIntent: 'DIRECT_ORDER',
              intents: ['DIRECT_ORDER', 'DIRECT_PAYMENT'],
              route: 'order',
              confidence: 0.9,
            }),
          },
          actionAdapter,
          handlers: {
            unsupported: jest.fn().mockResolvedValue({
              intent: AssistantIntent.UNSUPPORTED,
              nodeName: 'general',
              text: 'Mình không thể tạo đơn hoặc thanh toán trực tiếp trong chat. Bạn vui lòng xác nhận thao tác hợp lệ trong hệ thống GearVN.',
              metadata: {
                fallback_reason: 'DIRECT_ORDER_PAYMENT_BLOCKED',
              },
            }),
          },
        },
      },
    );

    expect(result.metadata).toEqual(
      expect.objectContaining({
        fallback_reason: 'DIRECT_ORDER_PAYMENT_BLOCKED',
        guardrail_decision: expect.objectContaining({
          rule: 'DIRECT_ORDER_PAYMENT_BLOCKED',
          action: 'block',
        }),
      }),
    );
    expect(result.text).toContain('không thể tạo đơn');
    expect(actionAdapter.createOrder).not.toHaveBeenCalled();
    expect(actionAdapter.createPayment).not.toHaveBeenCalled();
  });

  it('recalls saved preferences only for the authenticated owner profile', async () => {
    const promptContext = {
      sections: [
        {
          kind: 'profileMemory',
          content:
            'Hồ sơ hỗ trợ đã lưu\nSở thích ổn định: laptop học AI, ưu tiên RTX 4060',
        },
      ],
    };
    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'phase-09-1-memory-owner-room',
        customerId: 'customer-owner',
        authenticatedUserId: 'customer-owner',
        userText: 'nhớ mình thích laptop gì không?',
        promptContext,
      },
      {
        configurable: {
          promptContext,
          classifier: {
            classify: jest.fn().mockResolvedValue({
              primaryIntent: AssistantIntent.PRODUCT_ADVICE,
              intents: [AssistantIntent.PRODUCT_ADVICE],
              route: 'sales',
            }),
          },
          handlers: {
            productAdvice: jest.fn().mockImplementation((state) => {
              const profileText = JSON.stringify(state.promptContext ?? {});
              return {
                intent: AssistantIntent.PRODUCT_ADVICE,
                nodeName: 'sales',
                text: profileText.includes('laptop học AI')
                  ? 'Mình nhớ bạn thích laptop học AI và ưu tiên cấu hình RTX 4060.'
                  : 'Mình chưa thấy sở thích đã lưu cho tài khoản này.',
                metadata: { memory_used: true },
              };
            }),
          },
        },
      },
    );

    expect(result.text).toContain('Mình nhớ bạn thích laptop học AI');
    expect(VIETNAMESE_DIACRITIC_PATTERN.test(result.text ?? '')).toBe(true);
  });

  it('does not expose another customer or another room saved preference', async () => {
    const productAdvice = jest.fn().mockImplementation((state) => {
      const profileText = JSON.stringify(state.promptContext ?? {});
      return {
        intent: AssistantIntent.PRODUCT_ADVICE,
        nodeName: 'sales',
        text: profileText.includes('laptop học AI')
          ? 'Mình nhớ bạn thích laptop học AI.'
          : 'Mình chưa thấy sở thích đã lưu cho tài khoản này.',
        metadata: { memory_used: Boolean(profileText.includes('laptop học AI')) },
      };
    });

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'phase-09-1-memory-other-room',
        customerId: 'customer-other',
        authenticatedUserId: 'customer-other',
        userText: 'nhớ mình thích laptop gì không?',
        promptContext: { sections: [] },
      },
      {
        configurable: {
          promptContext: { sections: [] },
          classifier: {
            classify: jest.fn().mockResolvedValue({
              primaryIntent: AssistantIntent.PRODUCT_ADVICE,
              intents: [AssistantIntent.PRODUCT_ADVICE],
              route: 'sales',
            }),
          },
          handlers: { productAdvice },
        },
      },
    );

    expect(result.text).toBe('Mình chưa thấy sở thích đã lưu cho tài khoản này.');
    expect(result.text).not.toContain('laptop học AI');
  });

  it('reviews stored checkout phone and address before creating a redirect draft', async () => {
    const customerProfileService = {
      getCheckoutFields: jest.fn().mockResolvedValue({
        name: 'An',
        phone: '0912345678',
        address: '1 Nguyễn Huệ, Quận 1, TP.HCM',
      }),
    };
    const orderToolsService = new OrderToolsService(
      {} as any,
      undefined,
      { validatePublic: jest.fn(), listPublic: jest.fn() } as any,
      undefined,
      customerProfileService as any,
    );
    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'phase-09-1-checkout-memory-room',
        customerId: 'customer-owner',
        authenticatedUserId: 'customer-owner',
        userText: 'chuẩn bị checkout giúp mình',
      },
      {
        configurable: {
          classifier: {
            classify: jest.fn().mockResolvedValue({
              primaryIntent: AssistantIntent.CHECKOUT_PREP,
              intents: [AssistantIntent.CHECKOUT_PREP],
              route: 'order',
            }),
          },
          orderToolsService,
        },
      },
    );

    expect(customerProfileService.getCheckoutFields).toHaveBeenCalledWith('customer-owner');
    expect(result.text).toContain('Bạn kiểm tra lại tên, số điện thoại và địa chỉ');
    expect(result.metadata?.checkoutReview).toEqual(
      expect.objectContaining({
        name: 'An',
        phoneMasked: '091****678',
        addressPreview: expect.any(String),
        missingFields: [],
        actions: ['Đúng rồi', 'Chỉnh sửa'],
      }),
    );
    expect(JSON.stringify(result.metadata?.checkoutReview)).toContain('phone');
    expect(JSON.stringify(result.metadata?.checkoutReview)).toContain('address');
    expect(result.actionDrafts).toEqual([]);
  });

  it('parses comma-separated checkout contact continuation and suppresses order lookup', async () => {
    const checkoutPrep = jest.fn().mockResolvedValue({
      intent: AssistantIntent.CHECKOUT_PREP,
      nodeName: 'order',
      text: 'Mình đã chuẩn bị thông tin checkout và sẽ để bạn kiểm tra trước khi chuyển sang thanh toán.',
      metadata: {
        tool_calls: [
          {
            toolName: 'prepare_checkout_review',
            subgraph: 'order',
            status: 'success',
          },
        ],
      },
    });
    const orderLookup = jest.fn().mockResolvedValue({
      intent: AssistantIntent.ORDER_LOOKUP,
      nodeName: 'order',
      text: 'Đơn hàng của bạn: 0 đơn hàng gần nhất.',
      metadata: { orderCards: [] },
    });
    const promptContext = {
      sections: [
        {
          kind: 'hotMessages',
          content:
            'assistant: Mình cần bạn bổ sung đủ tên, số điện thoại và địa chỉ trước khi chuẩn bị thanh toán.',
        },
      ],
    };

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'phase-09-1-checkout-contact-room',
        customerId: 'customer-owner',
        authenticatedUserId: 'customer-owner',
        userText:
          'Dương Quốc Khánh, 0946317388, 25 Ngõ 77 Bùi Xương Trạch, Khương Đình, Thanh Xuân, Hà Nội',
        promptContext,
      },
      {
        configurable: {
          promptContext,
          classifier: {
            classify: jest.fn().mockResolvedValue({
              primaryIntent: AssistantIntent.ORDER_LOOKUP,
              intents: [AssistantIntent.ORDER_LOOKUP],
              route: 'order',
              entities: {},
            }),
          },
          handlers: {
            checkoutPrep,
            orderLookup,
          },
        },
      },
    );

    expect(checkoutPrep).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedEntities: expect.objectContaining({
          checkoutAction: 'CHECKOUT_REDIRECT',
          checkoutReviewAccepted: true,
          checkout: {
            name: 'Dương Quốc Khánh',
            phone: '0946317388',
            address:
              '25 Ngõ 77 Bùi Xương Trạch, Khương Đình, Thanh Xuân, Hà Nội',
          },
          name: 'Dương Quốc Khánh',
          phone: '0946317388',
          address:
            '25 Ngõ 77 Bùi Xương Trạch, Khương Đình, Thanh Xuân, Hà Nội',
        }),
        intents: [AssistantIntent.CHECKOUT_PREP],
      }),
    );
    expect(orderLookup).not.toHaveBeenCalled();
    expect(result.intentPlan).toEqual(
      expect.objectContaining({ needsOrderLookup: false }),
    );
    expect(result.metadata?.orderCards).toBeUndefined();
    expect(result.routeTrace).toContain('checkout_prep');
  });

  it('answers voucher-only questions without forcing checkout contact review', async () => {
    const voucherAdapter = {
      validatePublic: jest.fn(),
      listPublic: jest.fn().mockResolvedValue([
        {
          code: 'AI10',
          discountType: 'percentage',
          discountValue: 10,
          minimumOrderValue: 1_000_000,
          maximumDiscountAmount: 500_000,
        },
      ]),
    };
    const orderToolsService = new OrderToolsService(
      {} as any,
      undefined,
      voucherAdapter as any,
    );
    const checkoutSpy = jest.spyOn(orderToolsService, 'prepareCheckoutReview');

    const result = await shoppingAssistantGraph.invoke(
      {
        mode: AssistantMode.AI,
        roomId: 'phase-09-1-voucher-room',
        customerId: 'customer-owner',
        authenticatedUserId: 'customer-owner',
        userText: 'có voucher nào áp dụng không?',
      },
      {
        configurable: {
          classifier: {
            classify: jest.fn().mockResolvedValue({
              primaryIntent: AssistantIntent.CHECKOUT_PREP,
              intents: [AssistantIntent.CHECKOUT_PREP],
              route: 'order',
              entities: { checkoutAction: 'APPLY_VOUCHER' },
            }),
          },
          orderToolsService,
        },
      },
    );

    expect(checkoutSpy).not.toHaveBeenCalled();
    expect(voucherAdapter.listPublic).toHaveBeenCalled();
    expect(result.routeTrace).toEqual([
      'supervisor',
      'order',
      'voucher_advisory',
      'merge_response',
    ]);
    expect(result.text).toContain('AI10');
    expect(result.text).not.toContain('bổ sung đủ tên');
    expect(result.metadata?.checkoutReview).toBeUndefined();
  });
});
