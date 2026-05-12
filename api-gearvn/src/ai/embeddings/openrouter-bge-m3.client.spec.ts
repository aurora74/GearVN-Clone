import { OpenRouterBgeM3Client } from './openrouter-bge-m3.client';

const config = {
  openRouter: {
    apiKey: 'test-openrouter-key',
    apiKeyPresent: true,
    embeddingModel: 'baai/bge-m3',
  },
  qdrant: {
    apiKeyPresent: false,
    collection: 'products',
  },
};

describe('OpenRouterBgeM3Client', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = undefined as unknown as typeof fetch;
  });

  it('embeds document batches with the OpenRouter BGE-M3 request contract', async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse([
        [0.1, 0.2],
        [0.3, 0.4],
      ]),
    );
    const client = new OpenRouterBgeM3Client(config);

    const result = await client.embedDocuments(['laptop gaming', 'monitor'], {
      batchSize: 2,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-openrouter-key',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          model: 'baai/bge-m3',
          input: ['laptop gaming', 'monitor'],
          input_type: 'search_document',
          encoding_format: 'float',
        }),
      }),
    );
    expect(result).toEqual({
      vectors: [
        [0.1, 0.2],
        [0.3, 0.4],
      ],
      model: 'baai/bge-m3',
      vectorSize: 2,
      batchCount: 1,
    });
  });

  it('embeds queries with search_query input type', async () => {
    fetchMock.mockResolvedValueOnce(okResponse([[0.5, 0.6, 0.7]]));
    const client = new OpenRouterBgeM3Client(config);

    const result = await client.embedQuery('laptop for student');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      input: ['laptop for student'],
      input_type: 'search_query',
      encoding_format: 'float',
    });
    expect(result.vectors).toEqual([[0.5, 0.6, 0.7]]);
  });

  it('splits inputs into bounded batches', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse([[0.1], [0.2]]))
      .mockResolvedValueOnce(okResponse([[0.3]]));
    const client = new OpenRouterBgeM3Client(config);

    const result = await client.embedDocuments(['a', 'b', 'c'], {
      batchSize: 2,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.batchCount).toBe(2);
    expect(result.vectors).toEqual([[0.1], [0.2], [0.3]]);
  });

  it('retries transient 429 and 5xx responses without logging input text', async () => {
    jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
      callback();
      return 0 as unknown as NodeJS.Timeout;
    });
    fetchMock
      .mockResolvedValueOnce(errorResponse(429, 'rate limited with input text'))
      .mockResolvedValueOnce(okResponse([[0.1, 0.2]]));
    const client = new OpenRouterBgeM3Client(config);

    const result = await client.embedDocuments(['secret product text']);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.vectors).toEqual([[0.1, 0.2]]);
  });

  it('throws secret-safe non-OK errors after retries are exhausted', async () => {
    fetchMock.mockResolvedValue(
      errorResponse(400, 'bad key test-openrouter-key'),
    );
    const client = new OpenRouterBgeM3Client(config);

    await expect(
      client.embedDocuments(['secret product text']),
    ).rejects.toThrow('OpenRouter embeddings request failed with HTTP 400');
    await expect(
      client.embedDocuments(['secret product text']),
    ).rejects.not.toThrow('test-openrouter-key');
    await expect(
      client.embedDocuments(['secret product text']),
    ).rejects.not.toThrow('secret product text');
  });

  it('rejects malformed vectors and batch alignment mismatches', async () => {
    fetchMock.mockResolvedValueOnce(okResponse([[0.1], ['bad']]));
    const client = new OpenRouterBgeM3Client(config);

    await expect(
      client.embedDocuments(['valid', 'malformed'], { batchSize: 2 }),
    ).rejects.toThrow('Malformed OpenRouter embedding vector at batch item 1');
  });

  it('reports missing API key by env var name only', async () => {
    const client = new OpenRouterBgeM3Client({
      ...config,
      openRouter: {
        ...config.openRouter,
        apiKey: undefined,
        apiKeyPresent: false,
      },
    });

    await expect(client.embedDocuments(['text'])).rejects.toThrow(
      'Missing AI retrieval env vars: OPENROUTER_API_KEY',
    );
  });
});

function okResponse(vectors: unknown[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      model: 'baai/bge-m3',
      data: vectors.map((embedding, index) => ({ embedding, index })),
    }),
  };
}

function errorResponse(status: number, body: string) {
  return {
    ok: false,
    status,
    text: async () => body,
  };
}
