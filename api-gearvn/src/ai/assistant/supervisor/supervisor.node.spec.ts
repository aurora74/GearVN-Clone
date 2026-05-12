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
});
