import { AssistantIntent, AssistantMode } from '../assistant.types';
import { supervisorNode } from './supervisor.node';

describe('supervisorNode deterministic bypass', () => {
  const baseState = {
    mode: AssistantMode.AI,
    roomId: 'room-supervisor-hotfix',
    promptContext: {
      sections: [],
    },
  } as any;

  it.each([
    [
      'product advice',
      'gợi ý laptop gaming tầm 25 triệu',
      AssistantIntent.PRODUCT_ADVICE,
    ],
    [
      'product detail',
      'review chi tiết sản phẩm vừa recommend',
      AssistantIntent.REVIEW_SUMMARY,
    ],
    [
      'product specification detail',
      'Con Laptop Lenovo IdeaPad Slim 5 OLED 14AKP10 83HX001KVN thông số chi tiết như nào',
      AssistantIntent.REVIEW_SUMMARY,
    ],
    [
      'explicit public-source product detail',
      'review chi tiết mẫu vừa tư vấn, sau đó cho mình nguồn công khai trên mạng nói gì về mẫu này',
      AssistantIntent.REVIEW_SUMMARY,
    ],
    ['order lookup', 'kiểm tra đơn hàng của tôi', AssistantIntent.ORDER_LOOKUP],
    ['greeting', 'xin chào GearVN', AssistantIntent.UNSUPPORTED],
    [
      'staff handoff',
      'cho mình gặp nhân viên tư vấn',
      AssistantIntent.STAFF_HANDOFF,
    ],
  ])(
    'uses deterministic_bypass with bypass_confidence for high-confidence %s turns',
    async (_caseName, userText, expectedIntent) => {
      const classifier = { classify: jest.fn() };
      const supervisorModel = { invoke: jest.fn() };

      const result = await supervisorNode({ ...baseState, userText }, {
        configurable: {
          classifier,
          supervisorModel,
        },
      } as any);

      expect(classifier.classify).not.toHaveBeenCalled();
      expect(supervisorModel.invoke).not.toHaveBeenCalled();
      expect(result.intents).toEqual(expect.arrayContaining([expectedIntent]));
      expect(result.metadata).toMatchObject({
        deterministic_bypass: true,
        bypass_confidence: expect.any(Number),
      });
      expect(result.traceEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            node: 'supervisor',
            deterministic_bypass: true,
            bypass_confidence: expect.any(Number),
          }),
        ]),
      );
    },
  );

  it('routes memory recall directly to general unsupported without staff handoff leakage', async () => {
    const classifier = {
      classify: jest.fn().mockResolvedValue({
        route: 'general',
        confidence: 0.95,
        intents: [AssistantIntent.STAFF_HANDOFF],
      }),
    };

    const result = await supervisorNode(
      {
        ...baseState,
        userText: 'bạn có nhớ gì về mình không',
      },
      {
        configurable: {
          classifier,
        },
      } as any,
    );

    expect(classifier.classify).not.toHaveBeenCalled();
    expect(result.activeSubgraph).toBe('general');
    expect(result.intents).toEqual([AssistantIntent.UNSUPPORTED]);
    expect(result.metadata).toMatchObject({
      fallback_reason: 'memory_recall',
    });
  });

  it('routes more-options follow-ups with prior shopping context and no query echo', async () => {
    const classifier = { classify: jest.fn() };

    const result = await supervisorNode(
      {
        ...baseState,
        userText: 'có máy khác nữa không',
        promptContext: {
          sections: [
            {
              kind: 'hotMessages',
              content: 'customer: tư vấn laptop 30 triệu học Machine Learning',
            },
          ],
        },
      },
      {
        configurable: {
          classifier,
        },
      } as any,
    );

    expect(classifier.classify).not.toHaveBeenCalled();
    expect(result.activeSubgraph).toBe('sales');
    expect(result.intents).toEqual([AssistantIntent.PRODUCT_ADVICE]);
    expect(result.intentPlan).toMatchObject({
      requestedMoreOptions: true,
      contextualUserText: 'tư vấn laptop 30 triệu học Machine Learning',
    });
    expect(String(result.intentPlan?.contextualUserText)).not.toContain(
      'có máy khác nữa không',
    );
  });

  it('treats standalone stock wording as a stock constraint, not more-options', async () => {
    const classifier = { classify: jest.fn() };

    const result = await supervisorNode(
      {
        ...baseState,
        userText: 'laptop RTX 4090 dưới 20 triệu còn hàng',
      },
      { configurable: { classifier } } as any,
    );

    expect(classifier.classify).not.toHaveBeenCalled();
    expect(result.activeSubgraph).toBe('sales');
    expect(result.parsedEntities).toMatchObject({ stockRequired: true });
    expect(result.parsedEntities?.requestedMoreOptions).toBeUndefined();
    expect(result.intentPlan?.requestedMoreOptions).toBeUndefined();
  });
  it('keeps constraint follow-ups anchored to the last customer product category', async () => {
    const classifier = { classify: jest.fn() };

    const result = await supervisorNode(
      {
        ...baseState,
        userText: 'dưới 18 triệu, nhẹ, pin tốt',
        promptContext: {
          sections: [
            {
              kind: 'hotMessages',
              content:
                'customer: tư vấn laptop\nassistant: Mình cần thêm ngân sách.\nassistant: Gói hoà mạng Viettel không liên quan tới yêu cầu mua hàng.',
            },
          ],
        },
      },
      { configurable: { classifier } } as any,
    );

    expect(classifier.classify).not.toHaveBeenCalled();
    expect(result.activeSubgraph).toBe('sales');
    expect(result.intentPlan).toMatchObject({
      contextualUserText: 'tư vấn laptop dưới 18 triệu, nhẹ, pin tốt',
    });
    expect(result.parsedEntities).toMatchObject({ productCategory: 'laptop' });
    expect(String(result.intentPlan?.contextualUserText)).not.toContain('Viettel');
  });

  it('keeps generic laptop advice broad for product clarification', async () => {
    const classifier = { classify: jest.fn() };

    const result = await supervisorNode(
      {
        ...baseState,
        userText: 'mình cần tư vấn về laptop',
      },
      { configurable: { classifier } } as any,
    );

    expect(classifier.classify).not.toHaveBeenCalled();
    expect(result.activeSubgraph).toBe('sales');
    expect(result.intentPlan).toMatchObject({ broadNeed: true });
  });

  it('keeps slangy generic laptop advice broad for product clarification', async () => {
    const classifier = { classify: jest.fn() };

    const result = await supervisorNode(
      {
        ...baseState,
        userText: 'tư vấn laptop cho tao đê',
      },
      { configurable: { classifier } } as any,
    );

    expect(classifier.classify).not.toHaveBeenCalled();
    expect(result.activeSubgraph).toBe('sales');
    expect(result.intentPlan).toMatchObject({ broadNeed: true });
  });

  it('keeps generic descriptor laptop advice broad for product clarification', async () => {
    const classifier = { classify: jest.fn() };

    const result = await supervisorNode(
      {
        ...baseState,
        userText: 'tư vấn laptop phổ thông',
      },
      { configurable: { classifier } } as any,
    );

    expect(classifier.classify).not.toHaveBeenCalled();
    expect(result.activeSubgraph).toBe('sales');
    expect(result.intentPlan).toMatchObject({ broadNeed: true });
  });
  it('routes specific purpose laptop advice without broad clarification', async () => {
    const classifier = { classify: jest.fn() };

    const result = await supervisorNode(
      {
        ...baseState,
        userText: 'mình cần tư vấn laptop xem phim giải trí',
      },
      { configurable: { classifier } } as any,
    );

    expect(classifier.classify).not.toHaveBeenCalled();
    expect(result.activeSubgraph).toBe('sales');
    expect(result.intents).toEqual([AssistantIntent.PRODUCT_ADVICE]);
    expect(result.intentPlan).not.toMatchObject({ broadNeed: true });
  });

  it('merges more-options follow-up constraints with prior shopping context', async () => {
    const classifier = { classify: jest.fn() };

    const result = await supervisorNode(
      {
        ...baseState,
        userText: 'có máy khác phục vụ CAD/kỹ thuật không',
        promptContext: {
          sections: [
            {
              kind: 'hotMessages',
              content: 'customer: tư vấn PC 30 triệu',
            },
          ],
        },
      },
      { configurable: { classifier } } as any,
    );

    expect(classifier.classify).not.toHaveBeenCalled();
    expect(result.activeSubgraph).toBe('sales');
    expect(result.intentPlan).toMatchObject({
      requestedMoreOptions: true,
      contextualUserText: expect.stringContaining('tư vấn PC 30 triệu'),
    });
    expect(String(result.intentPlan?.contextualUserText)).toContain(
      'CAD/kỹ thuật',
    );
  });

  it('recovers product family from last recommendation ledger for aged-out terse follow-ups', async () => {
    const classifier = { classify: jest.fn() };

    const result = await supervisorNode(
      {
        ...baseState,
        userText: 'ưu tiên hiệu năng hơn',
        lastRecommendationLedger: [
          {
            rank: 1,
            productId: 'pc-1',
            name: 'PC Performance Alpha',
            category: 'PC',
            price: 30_000_000,
            stock: 2,
            specsSummary: 'CPU mạnh, GPU rời',
            createdAt: new Date('2026-05-16T00:00:00.000Z'),
          },
        ],
        promptContext: {
          sections: [
            {
              kind: 'hotMessages',
              content:
                'customer: có mẫu khác không\nassistant: Mình đã gửi thêm lựa chọn khác.',
            },
          ],
        },
      },
      { configurable: { classifier } } as any,
    );

    expect(classifier.classify).not.toHaveBeenCalled();
    expect(result.activeSubgraph).toBe('sales');
    expect(result.intents).toEqual([AssistantIntent.PRODUCT_ADVICE]);
    expect(result.intentPlan).toMatchObject({
      contextResolutionReason: 'shopping_constraint_continuation',
    });
    expect(String(result.intentPlan?.contextualUserText)).toContain('pc');
    expect(String(result.intentPlan?.contextualUserText)).toContain(
      'ưu tiên hiệu năng hơn',
    );
    expect(result.parsedEntities).toMatchObject({ productCategory: 'pc' });
  });

  it('routes courtesy after checkout context to general instead of checkout continuation', async () => {
    const classifier = { classify: jest.fn() };

    const result = await supervisorNode(
      {
        ...baseState,
        userText: 'ok cảm ơn',
        promptContext: {
          sections: [
            {
              kind: 'hotMessages',
              content:
                'customer: thanh toán giỏ hàng\nassistant: Mình đã chuẩn bị thông tin checkout.',
            },
          ],
        },
      },
      { configurable: { classifier } } as any,
    );

    expect(classifier.classify).not.toHaveBeenCalled();
    expect(result.activeSubgraph).toBe('general');
    expect(result.intents).toEqual([AssistantIntent.UNSUPPORTED]);
    expect(result.metadata).toMatchObject({ fallback_reason: 'courtesy' });
  });

  it('routes ambiguous_multi_intent and action-sensitive prompts through classifier/supervisor/guardrail', async () => {
    const classifier = {
      classify: jest.fn().mockResolvedValue({
        route: 'order',
        confidence: 0.72,
        intents: [AssistantIntent.CART_ACTION, AssistantIntent.REVIEW_SUMMARY],
        fallbackReason: 'ambiguous_multi_intent',
      }),
    };

    const result = await supervisorNode(
      {
        ...baseState,
        userText:
          'thêm cái thứ 2 vào giỏ rồi review cộng đồng xem trên mạng nói gì',
      },
      {
        configurable: {
          classifier,
        },
      } as any,
    );

    expect(classifier.classify).toHaveBeenCalled();
    expect(result.metadata).toMatchObject({
      fallback_reason: 'ambiguous_multi_intent',
    });
    expect(result.metadata?.deterministic_bypass).not.toBe(true);
  });

  it('routes ambiguous ASUS/MSI cart follow-ups to product clarification before order action', async () => {
    const classifier = {
      classify: jest.fn().mockResolvedValue({
        route: 'order',
        confidence: 0.9,
        intents: [AssistantIntent.CART_ACTION],
        entities: { cartAction: 'CART_ADD' },
      }),
    };

    const result = await supervisorNode(
      {
        ...baseState,
        userText: 'con ASUS TUF hoặc mẫu MSI ở trên thêm vào giỏ được không?',
      },
      {
        configurable: {
          classifier,
        },
      } as any,
    );

    expect(classifier.classify).toHaveBeenCalled();
    expect(result.activeSubgraph).toBe('sales');
    expect(result.primaryIntent).toBe(AssistantIntent.PRODUCT_ADVICE);
    expect(result.intents).toEqual([AssistantIntent.PRODUCT_ADVICE]);
    expect(result.parsedEntities).toMatchObject({
      pendingCartAction: 'CART_ADD',
      requiresProductSelection: true,
      blockedCartActionReason: 'ambiguous_product_reference',
    });
    expect(result.parsedEntities?.cartAction).toBeUndefined();
    expect(result.metadata?.deterministic_bypass).not.toBe(true);
  });
  it('keeps catalog detail ahead of cart action when the model routes a detail-plus-cart prompt to order', async () => {
    const classifier = {
      classify: jest.fn().mockResolvedValue({
        route: 'order',
        confidence: 0.9,
        intents: [AssistantIntent.CART_ACTION],
        entities: { cartAction: 'CART_ADD' },
      }),
    };

    const result = await supervisorNode(
      {
        ...baseState,
        userText:
          'review chi tiết cho mình con Lenovo ThinkBook 14 G7 IML 21MR006YVN và cho biết có thể thêm vào giỏ không',
      },
      {
        configurable: {
          classifier,
        },
      } as any,
    );

    expect(classifier.classify).toHaveBeenCalled();
    expect(result.activeSubgraph).toBe('sales');
    expect(result.primaryIntent).toBe(AssistantIntent.REVIEW_SUMMARY);
    expect(result.intents).toEqual([
      AssistantIntent.REVIEW_SUMMARY,
      AssistantIntent.CART_ACTION,
    ]);
    expect(result.parsedEntities).toMatchObject({ cartAction: 'CART_ADD' });
    expect(result.metadata?.deterministic_bypass).not.toBe(true);
  });

  it('does not derive product category from prior assistant combo prose', async () => {
    const classifier = {
      classify: jest.fn().mockResolvedValue({
        route: 'general',
        confidence: 0.55,
        intents: [AssistantIntent.UNSUPPORTED],
        entities: {},
      }),
    };

    const result = await supervisorNode(
      {
        ...baseState,
        userText: '30 triệu đổ xuống để học Machine Learning',
        promptContext: {
          sections: [
            {
              kind: 'hotMessages',
              content:
                'Assistant: mình chia theo từng nhóm sản phẩm: Laptop, Storage để bạn ráp một bộ dùng đồng bộ',
            },
          ],
        },
      },
      {
        configurable: {
          classifier,
        },
      } as any,
    );

    expect(classifier.classify).toHaveBeenCalledWith(
      '30 triệu đổ xuống để học Machine Learning',
    );
    expect(result.activeSubgraph).toBe('general');
    expect(result.parsedEntities?.productCategory).toBeUndefined();
    expect(result.parsedEntities?.contextualUserText).toBeUndefined();
  });
});
