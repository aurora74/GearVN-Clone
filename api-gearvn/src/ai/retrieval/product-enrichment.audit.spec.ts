import {
  auditProductEnrichment,
  buildImprovedProductSearchMetadata,
  summarizeEnrichmentRefreshNeed,
} from './product-enrichment.audit';

describe('product enrichment audit', () => {
  it('counts missing and empty enrichment fields without mutating products', () => {
    const product = {
      _id: 'product-1',
      name: 'Laptop Gaming ABC',
      slug: 'laptop-gaming-abc',
      category: 'laptop',
      description: 'Laptop choi game RTX',
      attributes: { cpu: 'Ryzen 7', ram: '16GB' },
      searchMetadata: {
        categoryPath: [],
        specsSummary: '',
        semanticTags: ['gaming'],
        useCases: [],
        targetUsers: undefined,
        searchText: '',
      },
    };
    const before = JSON.stringify(product);

    const report = auditProductEnrichment([product]);

    expect(JSON.stringify(product)).toBe(before);
    expect(report.secretKeysLogged).toBe(false);
    expect(report.checked).toBe(1);
    expect(report.missingByField).toEqual({
      categoryPath: 0,
      specsSummary: 0,
      semanticTags: 0,
      useCases: 0,
      targetUsers: 1,
      searchText: 0,
    });
    expect(report.emptyByField).toEqual({
      categoryPath: 1,
      specsSummary: 1,
      semanticTags: 0,
      useCases: 1,
      targetUsers: 0,
      searchText: 1,
    });
    expect(report.sampleIssues).toEqual(
      expect.arrayContaining([
        {
          productId: 'product-1',
          name: 'Laptop Gaming ABC',
          field: 'targetUsers',
          reason: 'missing',
        },
        {
          productId: 'product-1',
          name: 'Laptop Gaming ABC',
          field: 'categoryPath',
          reason: 'empty',
        },
      ]),
    );
  });

  it('detects changed search text and recommends deterministic metadata updates', () => {
    const product = {
      _id: 'product-2',
      name: 'Man hinh 27 inch',
      slug: 'man-hinh-27-inch',
      category: 'monitor',
      description: 'Man hinh lam viec 100Hz',
      attributes: { size: '27 inch', hz: 100 },
      searchMetadata: {
        categoryPath: ['Man hinh'],
        specsSummary: 'size: 27 inch | hz: 100',
        semanticTags: ['office'],
        useCases: ['work from home'],
        targetUsers: ['nhan vien van phong'],
        searchText: 'stale text',
      },
    };

    const improved = buildImprovedProductSearchMetadata(product);
    const report = auditProductEnrichment([product]);
    const summary = summarizeEnrichmentRefreshNeed([product]);

    expect(improved.searchText).not.toContain('stale text');
    expect(improved.searchText).toContain('Man hinh');
    expect(report.refreshRequired).toBe(true);
    expect(report.changedSearchTextIds).toEqual(['product-2']);
    expect(report.recommendedUpdates).toEqual([
      {
        productId: 'product-2',
        searchMetadata: improved,
      },
    ]);
    expect(summary).toEqual({
      checked: 1,
      refreshRequired: true,
      changedSearchTextIds: ['product-2'],
      recommendedUpdates: report.recommendedUpdates,
      secretKeysLogged: false,
    });
  });

  it('does not require refresh when stored enrichment matches derived metadata', () => {
    const product: {
      _id: string;
      name: string;
      slug: string;
      category: string;
      description: string;
      attributes: Record<string, unknown>;
      searchMetadata: {
        categoryPath: string[];
        specsSummary: string;
        semanticTags: string[];
        useCases: string[];
        targetUsers: string[];
        searchText?: string;
      };
    } = {
      _id: 'product-3',
      name: 'Ban phim co',
      slug: 'ban-phim-co',
      category: 'keyboard',
      description: 'Ban phim co gaming',
      attributes: { switch: 'blue' },
      searchMetadata: {
        categoryPath: ['Ban phim'],
        specsSummary: 'switch: blue',
        semanticTags: ['gaming'],
        useCases: ['gaming'],
        targetUsers: ['gamer'],
      },
    };
    product.searchMetadata.searchText =
      buildImprovedProductSearchMetadata(product).searchText;

    const report = auditProductEnrichment([product]);

    expect(report.refreshRequired).toBe(false);
    expect(report.changedSearchTextIds).toEqual([]);
    expect(report.recommendedUpdates).toEqual([]);
  });
});
