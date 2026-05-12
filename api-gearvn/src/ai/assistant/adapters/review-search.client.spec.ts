const mockOpenRouterInvoke = jest.fn();

jest.mock('@langchain/openrouter', () => ({
  ChatOpenRouter: jest.fn().mockImplementation(() => ({
    invoke: mockOpenRouterInvoke,
  })),
}));

import { ReviewSearchClient } from './review-search.client';

describe('ReviewSearchClient', () => {
  const originalApiKey = process.env.OPENROUTER_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                sources: [
                  {
                    title: 'Lenovo ThinkBook 14 G7 IML review',
                    url: 'https://reviews.example.test/thinkbook-14-g7-iml',
                    claims: [
                      {
                        text: 'Build quality is solid for office and study use.',
                        evidenceStrength: 'weak',
                      },
                    ],
                  },
                ],
              }),
            },
          },
        ],
      }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    if (originalApiKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalApiKey;
    }
    (global as any).fetch = originalFetch;
  });

  it('hard-times out a stalled LangChain web search and falls back to direct OpenRouter search', async () => {
    jest.useFakeTimers();
    mockOpenRouterInvoke.mockReturnValue(new Promise(() => undefined));

    const resultPromise = new ReviewSearchClient().search(
      'review Lenovo ThinkBook 14 G7 IML 21MR006YVN',
    );

    await jest.advanceTimersByTimeAsync(8_000);
    const result = await resultPromise;

    expect(mockOpenRouterInvoke).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      expect.objectContaining({
        title: 'Lenovo ThinkBook 14 G7 IML review',
        url: 'https://reviews.example.test/thinkbook-14-g7-iml',
      }),
    ]);
  });

  it('sends OpenRouter web-search tool and provider requirements in direct fallback requests', async () => {
    mockOpenRouterInvoke.mockResolvedValue({ content: '{"sources":[]}' });

    await new ReviewSearchClient().search('review Lenovo ThinkBook 14 G7 IML');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.tools).toEqual([{ type: 'openrouter:web_search' }]);
    expect(body.provider).toEqual({ require_parameters: true });
    expect(body.max_tokens).toBeLessThanOrEqual(1200);
  });
});
