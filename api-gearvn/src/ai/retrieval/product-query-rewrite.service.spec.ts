import { DeepSeekQueryRewriteClient } from './deepseek-query-rewrite.client';
import { Test } from '@nestjs/testing';
import {
  ProductQueryRewriteService,
  ProductQueryRewriteStatus,
} from './product-query-rewrite.service';

describe('ProductQueryRewriteService', () => {
  const client: jest.Mocked<Pick<DeepSeekQueryRewriteClient, 'rewriteJson'>> = {
    rewriteJson: jest.fn(),
  };

  beforeEach(() => {
    client.rewriteJson.mockReset();
  });

  function createService(model = 'deepseek-v4-pro') {
    return new ProductQueryRewriteService(
      client as unknown as DeepSeekQueryRewriteClient,
      {
        deepSeek: {
          apiKey: 'configured',
          apiKeyPresent: true,
          baseUrl: 'https://api.deepseek.com',
          model,
          timeoutMs: 90_000,
        },
      },
    );
  }

  function validPayload(overrides: Record<string, unknown> = {}) {
    return JSON.stringify({
      rewrittenQuery: 'laptop RTX RAM 16GB SSD 512GB',
      detectedIntents: ['AI_ML_LEARNING'],
      productGroups: ['laptop'],
      hardConstraints: {
        category: 'laptop',
        categoryHints: ['laptop'],
        minPrice: 10_000_000,
        maxPrice: 30_000_000,
        requiredSpecs: {
          ramGb: 16,
          ssdGb: 512,
          gpu: 'nvidia',
          unknownSpec: 'ignored',
        },
        unsafeFilter: 'ignored',
      },
      softSignals: ['sinh vien IT'],
      expandedKeywords: ['CUDA', 'RTX'],
      comboGroups: ['laptop'],
      clarificationNeeded: false,
      clarificationReason: null,
      confidence: 0.91,
      ...overrides,
    });
  }

  it('returns success metadata and normalized constraints for valid JSON', async () => {
    client.rewriteJson.mockResolvedValueOnce(validPayload());

    const result = await createService().rewrite({
      query: 'laptop học AI dưới 30 triệu',
    });

    expect(result.rewrite_status).toBe<ProductQueryRewriteStatus>('success');
    expect(result.rewrite_provider).toBe('deepseek');
    expect(result.rewrite_model).toBe('deepseek-v4-pro');
    expect(result.rewrite_retry_count).toBe(0);
    expect(result.rewritten_query).toBe('laptop RTX RAM 16GB SSD 512GB');
    expect(result.hardConstraints).toEqual({
      category: 'laptop',
      categoryHints: ['laptop'],
      minPrice: 10_000_000,
      maxPrice: 30_000_000,
      requiredSpecs: {
        ramGb: 16,
        ssdGb: 512,
        gpu: 'nvidia',
      },
    });
    expect(result.comboGroups).toEqual([]);
  });

  it('skips DeepSeek only when explicitly allowed and local single-category signals are sufficient', async () => {
    const result = await createService().rewrite({
      query: 'màn hình 2K màu tốt tầm 7 triệu',
      allowDeterministicShortCircuit: true,
    });

    expect(client.rewriteJson).not.toHaveBeenCalled();
    expect(result.rewrite_status).toBe('skipped_deterministic');
    expect(result.hardConstraints).toMatchObject({
      categoryHints: ['monitor'],
      maxPrice: 7_000_000,
      requiredSpecs: { displayResolution: '2k' },
    });
  });

  it.each([
    ['tư vấn laptop gaming khoảng 25 triệu', 'laptop'],
    ['laptop sinh viên văn phòng mỏng nhẹ dưới 18 triệu', 'laptop'],
    ['laptop RTX 4090 dưới 20 triệu còn hàng', 'laptop'],
  ])(
    'short-circuits explicit single-family advice with local grounding: %s',
    async (query, expectedCategory) => {
      const result = await createService().rewrite({
        query,
        allowDeterministicShortCircuit: true,
      });

      expect(client.rewriteJson).not.toHaveBeenCalled();
      expect(result.rewrite_status).toBe('skipped_deterministic');
      expect(result.hardConstraints.categoryHints).toEqual(
        expect.arrayContaining([expectedCategory]),
      );
    },
  );

  it('short-circuits AI/ML laptop advice when retrieval query adds synthetic GPU family text', async () => {
    const result = await createService().rewrite({
      query: 'rtx gpu laptop 30 triệu học AI/Machine Learning',
      originalQuery: 'laptop 30 triệu học AI/Machine Learning',
      allowDeterministicShortCircuit: true,
    });

    expect(client.rewriteJson).not.toHaveBeenCalled();
    expect(result.rewrite_status).toBe('skipped_deterministic');
    expect(result.hardConstraints).toMatchObject({
      categoryHints: ['laptop'],
      maxPrice: 30_000_000,
      requiredSpecs: {
        ramGb: 16,
        ssdGb: 512,
        gpu: 'nvidia',
      },
    });
  });

  it('keeps true multi-product laptop and graphics-card requests on DeepSeek', async () => {
    client.rewriteJson.mockResolvedValueOnce(validPayload());

    const result = await createService().rewrite({
      query: 'laptop và card đồ họa để học AI khoảng 30 triệu',
      allowDeterministicShortCircuit: true,
    });

    expect(client.rewriteJson).toHaveBeenCalledTimes(1);
    expect(result.rewrite_status).toBe('success');
  });

  it('keeps use-case-only shopping requests on DeepSeek even when short-circuit is allowed', async () => {
    client.rewriteJson.mockResolvedValueOnce(validPayload());

    const result = await createService().rewrite({
      query: 'gaming khoảng 25 triệu',
      allowDeterministicShortCircuit: true,
    });

    expect(client.rewriteJson).toHaveBeenCalledTimes(1);
    expect(result.rewrite_status).toBe('success');
  });
  it('calls DeepSeek when the deterministic short-circuit flag is absent', async () => {
    client.rewriteJson.mockResolvedValueOnce(validPayload());

    const result = await createService().rewrite({
      query: 'màn hình 2K màu tốt tầm 7 triệu',
    });

    expect(client.rewriteJson).toHaveBeenCalledTimes(1);
    expect(result.rewrite_status).toBe('success');
  });

  it('keeps combo/setup requests on DeepSeek even when the short-circuit flag is set', async () => {
    client.rewriteJson.mockResolvedValueOnce(
      validPayload({
        rewrittenQuery: 'setup làm việc tại nhà laptop màn hình',
        productGroups: ['laptop', 'monitor'],
        comboGroups: ['laptop', 'monitor'],
      }),
    );

    const result = await createService().rewrite({
      query: 'setup làm việc tại nhà laptop và màn hình',
      allowDeterministicShortCircuit: true,
    });

    expect(client.rewriteJson).toHaveBeenCalledTimes(1);
    expect(result.rewrite_status).toBe('success');
  });
  it('injects the concrete DeepSeek rewrite client through Nest providers', async () => {
    const rewriteJson = jest.fn().mockResolvedValueOnce(validPayload());
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductQueryRewriteService,
        {
          provide: DeepSeekQueryRewriteClient,
          useValue: { rewriteJson },
        },
      ],
    }).compile();

    const service = moduleRef.get(ProductQueryRewriteService);
    const result = await service.rewrite({ query: 'laptop học AI' });

    expect(rewriteJson).toHaveBeenCalledTimes(1);
    expect(result.rewrite_status).toBe('success');
    await moduleRef.close();
  });

  it('retries invalid JSON once before fallback_invalid_json', async () => {
    client.rewriteJson
      .mockResolvedValueOnce('{bad json')
      .mockResolvedValueOnce('');

    const result = await createService().rewrite({
      query: 'laptop học AI',
    });

    expect(client.rewriteJson).toHaveBeenCalledTimes(2);
    expect(result.rewrite_status).toBe('fallback_invalid_json');
    expect(result.rewrite_retry_count).toBe(1);
    expect(result.expandedKeywords).toEqual(expect.arrayContaining(['laptop']));
    expect(result.comboGroups).toEqual([]);
  });

  it('honors provider combo groups only for explicit setup requests', async () => {
    client.rewriteJson.mockResolvedValueOnce(
      validPayload({
        rewrittenQuery: 'setup làm việc tại nhà laptop màn hình',
        detectedIntents: ['WORK_FROM_HOME'],
        productGroups: ['laptop', 'monitor'],
        comboGroups: ['laptop', 'monitor'],
      }),
    );

    const result = await createService().rewrite({
      query: 'setup làm việc tại nhà',
    });

    expect(result.comboGroups).toEqual(['laptop', 'monitor']);
  });
  it('retries schema mismatch once before fallback_schema_mismatch', async () => {
    client.rewriteJson
      .mockResolvedValueOnce(
        JSON.stringify({ rewrittenQuery: 'missing fields' }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({ rewrittenQuery: 'still missing fields' }),
      );

    const result = await createService().rewrite({
      query: 'setup làm việc tại nhà',
    });

    expect(client.rewriteJson).toHaveBeenCalledTimes(2);
    expect(result.rewrite_status).toBe('fallback_schema_mismatch');
    expect(result.rewrite_retry_count).toBe(1);
    expect(result.comboGroups).toEqual(
      expect.arrayContaining(['monitor', 'keyboard', 'mouse']),
    );
  });

  it('returns fallback_low_confidence and local constraints for low confidence output', async () => {
    client.rewriteJson.mockResolvedValueOnce(validPayload({ confidence: 0.4 }));

    const result = await createService().rewrite({
      query: 'laptop RAM 16GB còn hàng',
    });

    expect(result.rewrite_status).toBe('fallback_low_confidence');
    expect(result.rewrite_retry_count).toBe(0);
    expect(result.hardConstraints.requiredSpecs?.ramGb).toBe(16);
    expect(result.hardConstraints.inStockOnly).toBe(true);
  });

  it('returns fallback_api_error when the provider fails', async () => {
    client.rewriteJson.mockRejectedValueOnce(new Error('DeepSeek unavailable'));

    const result = await createService().rewrite({
      query: 'máy mạnh giá tốt',
    });

    expect(result.rewrite_status).toBe('fallback_api_error');
    expect(result.rewrite_provider).toBe('deepseek');
    expect(result.rewritten_query).toBe('máy mạnh giá tốt');
    expect(result.expandedKeywords).toEqual(
      expect.arrayContaining(['gia tot']),
    );
  });
  it('returns fallback_timeout when a product-advice rewrite budget expires', async () => {
    let rewriteSignal: AbortSignal | undefined;
    client.rewriteJson.mockImplementationOnce((input) => {
      rewriteSignal = input.signal;
      return new Promise<string>(() => undefined);
    });

    const result = await createService().rewrite({
      query: 'laptop 30 triệu học AI/Machine Learning',
      timeoutMs: 5,
    });

    expect(client.rewriteJson).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 5 }),
    );
    expect(rewriteSignal?.aborted).toBe(true);
    expect(result.rewrite_status).toBe('fallback_timeout');
    expect(result.rewritten_query).toBe(
      'laptop 30 triệu học AI/Machine Learning',
    );
  });
  it('preserves original concrete specs when rewrite times out on contextual text', async () => {
    client.rewriteJson.mockImplementationOnce(
      () => new Promise<string>(() => undefined),
    );

    const result = await createService().rewrite({
      query: 'laptop dưới 20 triệu còn hàng',
      originalQuery: 'laptop RTX 4090 dưới 20 triệu còn hàng',
      timeoutMs: 5,
    });

    expect(result.rewrite_status).toBe('fallback_timeout');
    expect(result.hardConstraints).toMatchObject({
      categoryHints: ['laptop'],
      maxPrice: 20_000_000,
      inStockOnly: true,
      requiredSpecs: { gpu: 'rtx 4090' },
    });
  });

  it('rethrows upstream aborts instead of converting them into fallback', async () => {
    const abortController = new AbortController();
    abortController.abort();
    client.rewriteJson.mockRejectedValueOnce(
      new Error('DeepSeek rewrite request aborted'),
    );

    await expect(
      createService().rewrite({
        query: 'laptop học AI',
        signal: abortController.signal,
      }),
    ).rejects.toThrow('DeepSeek rewrite request aborted');
    expect(client.rewriteJson).toHaveBeenCalledTimes(1);
  });
});
