import { ChatOpenRouter } from '@langchain/openrouter';

import { AssistantResponseComposer } from './assistant-response-composer.service';
import type { AssistantProductCard } from './assistant.types';

const mockInvoke = jest.fn();
const mockConstructedOptions: Array<Record<string, unknown>> = [];

jest.mock('@langchain/openrouter', () => ({
  ChatOpenRouter: jest.fn().mockImplementation((options) => {
    mockConstructedOptions.push(options);
    return { invoke: mockInvoke };
  }),
}));

describe('AssistantResponseComposer', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConstructedOptions.length = 0;
    process.env = {
      ...originalEnv,
      OPENROUTER_API_KEY: 'test-openrouter-key',
    };
    delete process.env.OPENROUTER_CHAT_MAX_TOKENS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('parses AIMessage-like JSON message content and returns only the message', async () => {
    mockInvoke.mockResolvedValueOnce({
      content: JSON.stringify({
        message:
          'Mình ưu tiên Laptop Gaming RTX 4060 vì còn hàng và khớp nhu cầu chơi game.',
        referencedProductIds: ['laptop-4060'],
      }),
      response_metadata: { finish_reason: 'stop', model_name: 'openrouter-test' },
    });

    const result = await new AssistantResponseComposer().composeProductAdvice({
      userText: 'tư vấn laptop gaming khoảng 25 triệu',
      productCards: [buildProductCard()],
      followUpQuestions: [],
    });

    expect(result).toBe(
      'Mình ưu tiên Laptop Gaming RTX 4060 vì còn hàng và khớp nhu cầu chơi game.',
    );
    expect(ChatOpenRouter).toHaveBeenCalledTimes(1);
  });

  it('parses content array text blocks with a JSON message', async () => {
    mockInvoke.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            message:
              'Mình chọn Laptop Gaming RTX 4060 vì cấu hình khớp nhu cầu AI và còn hàng.',
          }),
        },
      ],
      response_metadata: { finish_reason: 'stop', model_name: 'openrouter-test' },
    });

    await expect(
      new AssistantResponseComposer().composeProductAdvice({
        userText: 'tư vấn laptop học AI khoảng 30 triệu',
        productCards: [buildProductCard()],
        followUpQuestions: [],
      }),
    ).resolves.toBe(
      'Mình chọn Laptop Gaming RTX 4060 vì cấu hình khớp nhu cầu AI và còn hàng.',
    );
  });

  it('accepts complete raw natural advice text when JSON parsing fails', async () => {
    mockInvoke.mockResolvedValueOnce({
      content:
        'Mình ưu tiên Laptop Gaming RTX 4060 vì cấu hình khớp nhu cầu học AI và sản phẩm đang còn hàng.',
      response_metadata: { finish_reason: 'stop', model_name: 'openrouter-test' },
    });

    await expect(
      new AssistantResponseComposer().composeProductAdvice({
        userText: 'tư vấn laptop học AI khoảng 30 triệu',
        productCards: [buildProductCard()],
        followUpQuestions: [],
      }),
    ).resolves.toBe(
      'Mình ưu tiên Laptop Gaming RTX 4060 vì cấu hình khớp nhu cầu học AI và sản phẩm đang còn hàng.',
    );
  });

  it('rejects truncated malformed JSON when finish_reason is length', async () => {
    mockInvoke.mockResolvedValueOnce({
      content:
        '{"message":"Mình ưu tiên Laptop Gaming RTX 4060 vì cấu hình khớp nhu cầu học AI',
      response_metadata: { finish_reason: 'length', model_name: 'openrouter-test' },
    });

    await expect(
      new AssistantResponseComposer().composeProductAdvice({
        userText: 'tư vấn laptop học AI khoảng 30 triệu',
        productCards: [buildProductCard()],
        followUpQuestions: [],
      }),
    ).resolves.toBeNull();
  });

  it('returns null for invoke rejection without masquerading as content', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('OpenRouter unavailable'));

    await expect(
      new AssistantResponseComposer().composeProductAdvice({
        userText: 'tư vấn laptop gaming khoảng 25 triệu',
        productCards: [buildProductCard()],
        followUpQuestions: [],
      }),
    ).resolves.toBeNull();
  });

  it('passes json_object response format and uses the smaller product-advice token budget', async () => {
    process.env.OPENROUTER_CHAT_MAX_TOKENS = '256';
    mockInvoke.mockResolvedValueOnce({
      content: JSON.stringify({
        message: 'Mình đã chọn mẫu phù hợp nhất từ các thẻ sản phẩm.',
      }),
    });

    await new AssistantResponseComposer().composeProductAdvice({
      userText: 'gợi ý laptop học tập',
      productCards: [buildProductCard({ productId: 'laptop-student' })],
      followUpQuestions: [],
    });

    expect(mockConstructedOptions[0]).toMatchObject({ maxTokens: 450 });
    expect(mockConstructedOptions[0].maxTokens).toBeLessThan(1200);
    expect(mockInvoke.mock.calls[0][1]).toMatchObject({
      response_format: { type: 'json_object' },
    });
  });

  it('includes continuity context for refinement composition', async () => {
    mockInvoke.mockResolvedValueOnce({
      content: JSON.stringify({
        message: 'Mình sẽ so lại các lựa chọn theo ưu tiên mới.',
      }),
    });

    await new AssistantResponseComposer().composeProductAdvice({
      userText: 'ưu tiên máy nhẹ hơn',
      productCards: [buildProductCard({ productId: 'current-option' })],
      priorRecommendations: [
        {
          rank: 1,
          productId: 'prior-option',
          name: 'Prior Option',
          category: 'Laptop',
          price: 24_990_000,
          stock: 4,
          specsSummary: 'RAM 16GB',
          specs: { summary: 'RAM 16GB' },
        },
      ],
      preferenceDelta: 'ưu tiên máy nhẹ hơn',
      consultationMode: 'refinement',
      followUpQuestions: [],
    });

    const systemPrompt = mockInvoke.mock.calls[0][0][0].content;
    const payload = JSON.parse(mockInvoke.mock.calls[0][0][1].content);
    expect(systemPrompt).toContain('consultationMode is refinement');
    expect(payload).toMatchObject({
      consultationMode: 'refinement',
      preferenceDelta: 'ưu tiên máy nhẹ hơn',
      priorRecommendations: [
        expect.objectContaining({
          rank: 1,
          productId: 'prior-option',
          specsSummary: 'RAM 16GB',
        }),
      ],
    });
  });
  it('keeps query-relevant battery and performance specs in product evidence', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        content: JSON.stringify({ message: 'Mẫu này hợp vì có pin tốt.' }),
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({ message: 'Mẫu này hợp vì GPU và RAM tốt.' }),
      });

    await new AssistantResponseComposer().composeProductAdvice({
      userText: 'laptop sinh viên văn phòng mỏng nhẹ dưới 18 triệu, ưu tiên pin',
      productCards: [
        buildProductCard({
          specs: {
            color: 'silver',
            webcam: 'HD',
            keyboard: 'backlit',
            ports: 'USB-C',
            audio: 'stereo',
            battery: '60Wh',
            weight: '1.25kg',
          },
        }),
      ],
      followUpQuestions: [],
    });
    await new AssistantResponseComposer().composeProductAdvice({
      userText: 'tư vấn laptop gaming AI khoảng 25 triệu',
      productCards: [
        buildProductCard({
          specs: {
            color: 'black',
            webcam: 'FHD',
            keyboard: 'RGB',
            ports: 'HDMI',
            audio: 'stereo',
            gpu: 'RTX 4060',
            ram: '16GB',
            cpu: 'Intel Core i7',
          },
        }),
      ],
      followUpQuestions: [],
    });

    const pinPayload = JSON.parse(mockInvoke.mock.calls[0][0][1].content);
    const gamingPayload = JSON.parse(mockInvoke.mock.calls[1][0][1].content);
    expect(pinPayload.productCards[0].specs).toMatchObject({
      battery: '60Wh',
      weight: '1.25kg',
    });
    expect(gamingPayload.productCards[0].specs).toMatchObject({
      gpu: 'RTX 4060',
      ram: '16GB',
      cpu: 'Intel Core i7',
    });
  });
});

function buildProductCard(
  overrides: Partial<AssistantProductCard> = {},
): AssistantProductCard {
  const productId = String(overrides.productId ?? 'laptop-4060');
  return {
    productId,
    name: 'Laptop Gaming RTX 4060',
    detailHref: '/products/laptop-4060',
    price: 24_990_000,
    stock: 4,
    reasons: [],
    availability: { status: 'available', addable: true },
    actionPayload: { productId, actions: ['ADD_TO_CART'] },
    specs: {},
    ...overrides,
  };
}
