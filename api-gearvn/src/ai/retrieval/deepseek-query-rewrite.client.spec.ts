import { readDeepSeekRewriteConfig } from '../config/deepseek-rewrite.config';
import { DeepSeekQueryRewriteClient } from './deepseek-query-rewrite.client';

describe('DeepSeek rewrite config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.DEEPSEEK_REWRITE_MODEL;
    delete process.env.DEEPSEEK_REWRITE_TIMEOUT_MS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses official DeepSeek defaults without requiring secrets', () => {
    const config = readDeepSeekRewriteConfig();

    expect(config.deepSeek.baseUrl).toBe('https://api.deepseek.com');
    expect(config.deepSeek.model).toBe('deepseek-v4-pro');
    expect(config.deepSeek.timeoutMs).toBe(90_000);
    expect(config.deepSeek.apiKeyPresent).toBe(false);
  });

  it('reports only the missing env var name when secrets are required', () => {
    expect(() => readDeepSeekRewriteConfig({ requireSecrets: true })).toThrow(
      'DEEPSEEK_API_KEY',
    );
  });
});

describe('DeepSeekQueryRewriteClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.useRealTimers();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts strict JSON chat completions with Authorization from config', async () => {
    const apiKey = ['secret', 'from', 'config'].join('-');
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"rewrittenQuery":"laptop RTX"}' } }],
        }),
        { status: 200 },
      ),
    );

    const client = new DeepSeekQueryRewriteClient({
      deepSeek: {
        apiKey,
        apiKeyPresent: true,
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-pro',
        timeoutMs: 90_000,
      },
    });

    const result = await client.rewriteJson({
      messages: [{ role: 'user', content: 'laptop hoc AI' }],
    });

    expect(result).toBe('{"rewrittenQuery":"laptop RTX"}');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        }),
      }),
    );

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      model: 'deepseek-v4-pro',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: 'laptop hoc AI' }],
    });
  });

  it('retries transient HTTP failures once', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"rewrittenQuery":"laptop"}' } }],
          }),
          { status: 200 },
        ),
      );

    const client = new DeepSeekQueryRewriteClient({
      deepSeek: {
        apiKey: 'configured',
        apiKeyPresent: true,
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-pro',
        timeoutMs: 90_000,
      },
    });

    await expect(
      client.rewriteJson({
        messages: [{ role: 'user', content: 'laptop' }],
      }),
    ).resolves.toBe('{"rewrittenQuery":"laptop"}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries local request timeouts once before returning timeout-safe errors', async () => {
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise((_resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }

        signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      });
    });
    const client = new DeepSeekQueryRewriteClient({
      deepSeek: {
        apiKey: 'configured',
        apiKeyPresent: true,
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-pro',
        timeoutMs: 1,
      },
    });

    await expect(
      client.rewriteJson({
        messages: [{ role: 'user', content: 'laptop' }],
      }),
    ).rejects.toThrow('DeepSeek rewrite request timed out');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry upstream caller aborts as timeouts', async () => {
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise((_resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }

        signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      });
    });
    const client = new DeepSeekQueryRewriteClient({
      deepSeek: {
        apiKey: 'configured',
        apiKeyPresent: true,
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-pro',
        timeoutMs: 90_000,
      },
    });
    const upstreamController = new AbortController();

    const rewritePromise = client.rewriteJson({
      messages: [{ role: 'user', content: 'laptop' }],
      signal: upstreamController.signal,
    });
    upstreamController.abort();

    await expect(rewritePromise).rejects.toThrow(
      'DeepSeek rewrite request aborted',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
