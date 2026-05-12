import { AssistantIntent } from '../assistant.types';
import {
  classifyIntentsNode,
  ClassifyIntentsResultSchema,
} from './classify-intents.node';
import { mergeAssistantResponses } from './merge-response.node';
import { splitIntentsNode } from './split-intents.node';
import { unsupportedNode } from './unsupported.node';

describe('controlled assistant routing nodes', () => {
  it('uses structured classifier output with no more than two retries before unsupported fallback', async () => {
    const classifier = {
      classify: jest
        .fn()
        .mockResolvedValueOnce({ primaryIntent: 'UNKNOWN' })
        .mockResolvedValueOnce({ intents: ['NOPE'] })
        .mockResolvedValueOnce({
          primaryIntent: AssistantIntent.PRODUCT_ADVICE,
          intents: [AssistantIntent.PRODUCT_ADVICE],
        }),
    };

    const result = await classifyIntentsNode(
      { userText: 'So sanh danh gia giup minh' },
      {
        configurable: {
          classifier,
        },
      },
    );

    expect(ClassifyIntentsResultSchema.safeParse(result).success).toBe(true);
    expect(classifier.classify).toHaveBeenCalledTimes(3);
    expect(result.primaryIntent).toBe(AssistantIntent.PRODUCT_ADVICE);

    classifier.classify.mockClear();
    classifier.classify.mockResolvedValue({ primaryIntent: 'INVALID' });

    await expect(
      classifyIntentsNode(
        { userText: 'Lam tho giup minh' },
        { configurable: { classifier } },
      ),
    ).resolves.toMatchObject({
      primaryIntent: AssistantIntent.UNSUPPORTED,
      intents: [AssistantIntent.UNSUPPORTED],
    });
    expect(classifier.classify).toHaveBeenCalledTimes(3);
  });

  it('routes obvious product purchase requests deterministically before classifier fallback', async () => {
    const classifier = {
      classify: jest.fn().mockResolvedValue({
        primaryIntent: AssistantIntent.UNSUPPORTED,
        intents: [AssistantIntent.UNSUPPORTED],
      }),
    };

    const result = await classifyIntentsNode(
      { userText: 'mua máy tính' },
      { configurable: { classifier } },
    );

    expect(result).toMatchObject({
      primaryIntent: AssistantIntent.PRODUCT_ADVICE,
      intents: [AssistantIntent.PRODUCT_ADVICE],
      reason: 'deterministic_commerce_flow',
    });
    expect(classifier.classify).not.toHaveBeenCalled();
  });

  it('handles greeting-only messages without calling the classifier or showing out_of_scope', async () => {
    const classifier = {
      classify: jest.fn().mockResolvedValue({
        primaryIntent: AssistantIntent.UNSUPPORTED,
        intents: [AssistantIntent.UNSUPPORTED],
      }),
    };

    const classification = await classifyIntentsNode(
      { userText: 'chào bạn' },
      { configurable: { classifier } },
    );
    const response = unsupportedNode({ userText: 'hello' });

    expect(classification).toMatchObject({
      primaryIntent: AssistantIntent.UNSUPPORTED,
      intents: [AssistantIntent.UNSUPPORTED],
      reason: 'greeting',
    });
    expect(classifier.classify).not.toHaveBeenCalled();
    expect(response.text).toContain('GearVN AI');
    expect(response.metadata).not.toHaveProperty('unsupportedReason');
  });

  it('marks generic laptop advice as broad so the product node can clarify first', async () => {
    const classifier = {
      classify: jest.fn().mockResolvedValue({
        primaryIntent: AssistantIntent.UNSUPPORTED,
        intents: [AssistantIntent.UNSUPPORTED],
      }),
    };

    const result = await classifyIntentsNode(
      { userText: 'mình cần tư vấn về laptop' },
      { configurable: { classifier } },
    );

    expect(result).toMatchObject({
      primaryIntent: AssistantIntent.PRODUCT_ADVICE,
      intents: [AssistantIntent.PRODUCT_ADVICE],
      entities: expect.objectContaining({ broadNeed: true }),
      reason: 'deterministic_commerce_flow',
    });
    expect(classifier.classify).not.toHaveBeenCalled();
  });
  it('answers shopping memory recall from same-room prompt context', () => {
    const result = unsupportedNode({
      userText: 'bạn có nhớ gì về mình không?',
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
    });

    expect(result.text).toContain('Mình nhớ');
    expect(result.text).toContain('laptop học AI');
    expect(result.metadata).toMatchObject({
      memoryRecall: true,
      memory_used: [expect.objectContaining({ label: 'conversation_context' })],
    });
  });

  it('only parallelizes read-only whitelisted multi-intent pairs', () => {
    expect(
      splitIntentsNode({
        intents: [
          AssistantIntent.PRODUCT_ADVICE,
          AssistantIntent.REVIEW_SUMMARY,
        ],
      }),
    ).toMatchObject({
      executionMode: 'parallel',
      orderedIntents: [
        AssistantIntent.PRODUCT_ADVICE,
        AssistantIntent.REVIEW_SUMMARY,
      ],
    });

    expect(
      splitIntentsNode({
        intents: [AssistantIntent.PRODUCT_ADVICE, AssistantIntent.CART_ACTION],
      }),
    ).toMatchObject({
      executionMode: 'sequential',
      orderedIntents: [
        AssistantIntent.PRODUCT_ADVICE,
        AssistantIntent.CART_ACTION,
      ],
    });
  });

  it('refuses direct order and payment creation in Vietnamese with safe alternatives', () => {
    const result = unsupportedNode({
      userText: 'Tao don va thanh toan luon cho toi',
    });

    expect(result.text).toContain('không thể tạo đơn hàng');
    expect(result.text).toContain('không thể thực hiện thanh toán');
    expect(result.metadata).toMatchObject({
      checkoutAlternative: true,
      staffAlternative: true,
    });
  });

  it('merges action state before advice, supporting information, and fallback', () => {
    const merged = mergeAssistantResponses([
      {
        intent: AssistantIntent.UNSUPPORTED,
        nodeName: 'unsupported',
        text: 'fallback',
      },
      {
        intent: AssistantIntent.REVIEW_SUMMARY,
        nodeName: 'review_summary',
        text: 'review',
      },
      {
        intent: AssistantIntent.PRODUCT_ADVICE,
        nodeName: 'product_advice',
        text: 'advice',
      },
      {
        intent: AssistantIntent.CART_ACTION,
        nodeName: 'cart_action',
        text: 'action',
      },
    ]);

    expect(merged.orderedNodeNames).toEqual([
      'cart_action',
      'product_advice',
      'review_summary',
      'unsupported',
    ]);
    expect(merged.text).toMatch(
      /action[\s\S]*advice[\s\S]*review[\s\S]*fallback/,
    );
  });
});
