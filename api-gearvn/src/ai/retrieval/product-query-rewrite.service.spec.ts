import { DeepSeekQueryRewriteClient } from './deepseek-query-rewrite.client';
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
    return new ProductQueryRewriteService(client, {
      deepSeek: {
        apiKey: 'configured',
        apiKeyPresent: true,
        baseUrl: 'https://api.deepseek.com',
        model,
        timeoutMs: 90_000,
      },
    });
  }

  function validPayload(overrides: Record<string, unknown> = {}) {
    return JSON.stringify({
      rewrittenQuery: 'laptop RTX RAM 16GB SSD 512GB',
      detectedIntents: ['AI_ML_LEARNING'],
      productGroups: ['laptop'],
      hardConstraints: {
        category: 'laptop',
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
      minPrice: 10_000_000,
      maxPrice: 30_000_000,
      requiredSpecs: {
        ramGb: 16,
        ssdGb: 512,
        gpu: 'nvidia',
      },
    });
  });

  it('retries invalid JSON once before fallback_invalid_json', async () => {
    client.rewriteJson.mockResolvedValueOnce('{bad json').mockResolvedValueOnce('');

    const result = await createService().rewrite({
      query: 'laptop học AI',
    });

    expect(client.rewriteJson).toHaveBeenCalledTimes(2);
    expect(result.rewrite_status).toBe('fallback_invalid_json');
    expect(result.rewrite_retry_count).toBe(1);
    expect(result.expandedKeywords).toEqual(expect.arrayContaining(['laptop']));
  });

  it('retries schema mismatch once before fallback_schema_mismatch', async () => {
    client.rewriteJson
      .mockResolvedValueOnce(JSON.stringify({ rewrittenQuery: 'missing fields' }))
      .mockResolvedValueOnce(JSON.stringify({ rewrittenQuery: 'still missing fields' }));

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
    expect(result.expandedKeywords).toEqual(expect.arrayContaining(['gia tot']));
  });
});
