import { ProductContextResolver } from './product-context.resolver';

describe('ProductContextResolver', () => {
  const roomId = 'room-hotfix-1';
  const otherRoomId = 'room-hotfix-other';
  const ledgerProducts = [
    {
      rank: 1,
      productId: 'lenovo-thinkbook-14-g7-iml',
      name: 'Lenovo ThinkBook 14 G7 IML 21MR006YVN',
      slug: 'lenovo-thinkbook-14-g7-iml-21mr006yvn',
      normalizedName: 'lenovo thinkbook 14 g7 iml 21mr006yvn',
      category: 'Laptop',
      price: 18_990_000,
      stock: 5,
      specsSummary: 'Intel Core Ultra, RAM 16GB, SSD 512GB',
    },
    {
      rank: 2,
      productId: 'asus-tuf-a15-fa506ncg-hn184w',
      name: 'Laptop ASUS TUF Gaming A15 FA506NCG-HN184W',
      slug: 'laptop-asus-tuf-gaming-a15-fa506ncg-hn184w',
      normalizedName: 'asus tuf gaming a15 fa506ncg hn184w',
      category: 'Laptop',
      price: 21_990_000,
      stock: 3,
      specsSummary: 'Ryzen 5, RTX 3050, RAM 16GB',
    },
    {
      rank: 3,
      productId: 'msi-cyborg-15-a13v',
      name: 'Laptop MSI Cyborg 15 A13V',
      slug: 'laptop-msi-cyborg-15-a13v',
      normalizedName: 'msi cyborg 15 a13v',
      category: 'Laptop',
      price: 22_490_000,
      stock: 2,
      specsSummary: 'Intel Core i5, RTX 4050, RAM 16GB',
    },
  ];

  const sessionService = {
    getLastRecommendationLedger: jest.fn(),
    resolveRecommendationReference: jest.fn(),
  };
  const catalogAdapter = {
    findProductDetailsByNameOrSlug: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sessionService.getLastRecommendationLedger.mockImplementation(
      async (requestedRoomId: string) =>
        requestedRoomId === roomId ? ledgerProducts : [],
    );
    catalogAdapter.findProductDetailsByNameOrSlug.mockResolvedValue([
      {
        productId: 'catalog-dell-inspiron-15',
        name: 'Laptop Dell Inspiron 15',
        slug: 'laptop-dell-inspiron-15',
      },
    ]);
  });

  it('resolves rank references before any name or slug lookup and records ledger.rank', async () => {
    const resolver = new ProductContextResolver(
      sessionService as any,
      catalogAdapter as any,
    );

    const result = await resolver.resolve({
      roomId,
      userText: 'review cái thứ 2 giúp mình',
    });

    expect(result).toMatchObject({
      product: expect.objectContaining({
        productId: 'asus-tuf-a15-fa506ncg-hn184w',
      }),
      matchSource: 'ledger.rank',
      confidence: expect.any(Number),
    });
    expect(sessionService.getLastRecommendationLedger).toHaveBeenCalledWith(
      roomId,
    );
    expect(sessionService.getLastRecommendationLedger).not.toHaveBeenCalledWith(
      otherRoomId,
    );
    expect(
      catalogAdapter.findProductDetailsByNameOrSlug,
    ).not.toHaveBeenCalled();
  });

  it('resolves Vietnamese ordinal product nouns from the recommendation ledger only', async () => {
    const resolver = new ProductContextResolver(
      sessionService as any,
      catalogAdapter as any,
    );

    await expect(
      resolver.resolve({
        roomId,
        userText: 'thêm cho mình con thứ nhất vào giỏ',
      }),
    ).resolves.toMatchObject({
      matchSource: 'ledger.rank',
      product: expect.objectContaining({
        productId: 'lenovo-thinkbook-14-g7-iml',
      }),
    });

    expect(
      catalogAdapter.findProductDetailsByNameOrSlug,
    ).not.toHaveBeenCalled();
  });

  it('does not catalog-search unresolved ordinal references', async () => {
    sessionService.getLastRecommendationLedger.mockResolvedValueOnce([]);
    const resolver = new ProductContextResolver(
      sessionService as any,
      catalogAdapter as any,
    );

    await expect(
      resolver.resolve({
        roomId,
        userText: 'thêm cho mình cái số 3 vào giỏ',
      }),
    ).resolves.toMatchObject({
      status: 'unresolved',
      matchSource: 'unresolved',
      product: null,
    });

    expect(
      catalogAdapter.findProductDetailsByNameOrSlug,
    ).not.toHaveBeenCalled();
  });

  it('resolves latest recommendation wording to the first recent product before public review routing', async () => {
    const resolver = new ProductContextResolver(
      sessionService as any,
      catalogAdapter as any,
    );

    const result = await resolver.resolve({
      roomId,
      userText:
        'review chi tiết mẫu vừa tư vấn, sau đó cho mình nguồn công khai trên mạng nói gì về mẫu này',
    });

    expect(result).toMatchObject({
      matchSource: 'ledger.latest_recommendation',
      product: expect.objectContaining({
        productId: 'lenovo-thinkbook-14-g7-iml',
      }),
    });
    expect(
      catalogAdapter.findProductDetailsByNameOrSlug,
    ).not.toHaveBeenCalled();
  });

  it('prefers an explicit product model over generic latest-recommendation wording', async () => {
    sessionService.getLastRecommendationLedger.mockResolvedValueOnce([
      {
        rank: 1,
        productId: 'lenovo-loq-15iax9e',
        name: 'Laptop Lenovo LOQ 15IAX9E 83LK0079VN',
        slug: 'laptop-lenovo-loq-15iax9e-83lk0079vn',
        normalizedName: 'laptop lenovo loq 15iax9e 83lk0079vn',
        category: 'Laptop',
        price: 23_990_000,
        discountPrice: 22_390_000,
        stock: 10,
        createdAt: new Date('2026-05-13T00:00:00.000Z'),
      },
      {
        rank: 2,
        productId: 'ideapad-slim-5-oled-14akp10-83hx001kvn',
        name: 'Laptop Lenovo IdeaPad Slim 5 OLED 14AKP10 83HX001KVN',
        slug: 'laptop-lenovo-ideapad-slim-5-oled-14akp10-83hx001kvn',
        normalizedName: 'laptop lenovo ideapad slim 5 oled 14akp10 83hx001kvn',
        category: 'Laptop',
        price: 23_090_000,
        discountPrice: 21_990_000,
        stock: 10,
        createdAt: new Date('2026-05-13T00:00:00.000Z'),
      },
      {
        rank: 3,
        productId: 'ideapad-slim-5-oled-14akp10-83hx001jvn',
        name: 'Laptop Lenovo IdeaPad Slim 5 OLED 14AKP10 83HX001JVN',
        slug: 'laptop-lenovo-ideapad-slim-5-oled-14akp10-83hx001jvn',
        normalizedName: 'laptop lenovo ideapad slim 5 oled 14akp10 83hx001jvn',
        category: 'Laptop',
        price: 31_490_000,
        discountPrice: 27_990_000,
        stock: 10,
        createdAt: new Date('2026-05-13T00:00:00.000Z'),
      },
    ]);
    const resolver = new ProductContextResolver(
      sessionService as any,
      catalogAdapter as any,
    );

    const result = await resolver.resolve({
      roomId,
      userText:
        'mình cần thông tin chi tiết của laptop IdeaPad Slim 5 OLED 14AKP10 83HX001KVN bạn vừa đề xuất ở trên',
    });

    expect(result).toMatchObject({
      matchSource: 'ledger.identifier_token',
      product: expect.objectContaining({
        productId: 'ideapad-slim-5-oled-14akp10-83hx001kvn',
      }),
    });
  });

  it('uses exact name before slug, normalized_name, fuzzy_name, and catalog.name_search fallback', async () => {
    const resolver = new ProductContextResolver(
      sessionService as any,
      catalogAdapter as any,
    );

    await expect(
      resolver.resolve({
        roomId,
        userText:
          'review chi tiết hơn Laptop ASUS TUF Gaming A15 FA506NCG-HN184W',
      }),
    ).resolves.toMatchObject({
      matchSource: 'ledger.exact_name',
      product: expect.objectContaining({
        slug: 'laptop-asus-tuf-gaming-a15-fa506ncg-hn184w',
      }),
    });

    await expect(
      resolver.resolve({
        roomId,
        userText: 'mở laptop-asus-tuf-gaming-a15-fa506ncg-hn184w',
      }),
    ).resolves.toMatchObject({ matchSource: 'ledger.slug' });

    await expect(
      resolver.resolve({ roomId, userText: 'review asus tuf gaming a15' }),
    ).resolves.toMatchObject({ matchSource: 'ledger.normalized_name' });

    await expect(
      resolver.resolve({ roomId, userText: 'review asus tuff a15' }),
    ).resolves.toMatchObject({ matchSource: 'ledger.fuzzy_name' });

    await expect(
      resolver.resolve({
        roomId,
        userText: 'review con Laptop Dell Inspiron 15',
      }),
    ).resolves.toMatchObject({ matchSource: 'catalog.name_search' });
  });

  it('extracts a catalog product name from natural-language detail requests before full-sentence lookup', async () => {
    sessionService.getLastRecommendationLedger.mockResolvedValueOnce([]);
    catalogAdapter.findProductDetailsByNameOrSlug.mockImplementationOnce(
      async (query: string) =>
        query === 'lenovo thinkbook 14 g7 iml 21mr006yvn'
          ? [
              {
                productId: 'lenovo-thinkbook-14-g7-iml',
                name: 'Lenovo ThinkBook 14 G7 IML 21MR006YVN',
                slug: 'lenovo-thinkbook-14-g7-iml-21mr006yvn',
              },
            ]
          : [],
    );
    const resolver = new ProductContextResolver(
      sessionService as any,
      catalogAdapter as any,
    );

    const result = await resolver.resolve({
      roomId,
      userText:
        'review chi tiết cho mình con Lenovo ThinkBook 14 G7 IML 21MR006YVN sau đó cho mình nguồn công khai trên mạng',
    });

    expect(result).toMatchObject({
      matchSource: 'catalog.name_search',
      product: expect.objectContaining({
        productId: 'lenovo-thinkbook-14-g7-iml',
      }),
    });
    expect(catalogAdapter.findProductDetailsByNameOrSlug).toHaveBeenCalledWith(
      'lenovo thinkbook 14 g7 iml 21mr006yvn',
      5,
    );
  });

  it('returns clarification metadata instead of guessing ambiguous ASUS/MSI family matches', async () => {
    sessionService.getLastRecommendationLedger.mockResolvedValueOnce([
      ledgerProducts[1],
      {
        ...ledgerProducts[1],
        rank: 4,
        productId: 'asus-tuf-a15-fa507',
        name: 'Laptop ASUS TUF Gaming A15 FA507',
        slug: 'laptop-asus-tuf-gaming-a15-fa507',
      },
      ledgerProducts[2],
      {
        ...ledgerProducts[2],
        rank: 5,
        productId: 'msi-katana-15-b13v',
        name: 'Laptop MSI Katana 15 B13V',
        slug: 'laptop-msi-katana-15-b13v',
      },
    ]);
    const resolver = new ProductContextResolver(
      sessionService as any,
      catalogAdapter as any,
    );

    const result = await resolver.resolve({
      roomId,
      userText: 'con ASUS TUF hoặc mẫu MSI ở trên thêm vào giỏ được không?',
    });

    expect(result).toMatchObject({
      matchSource: 'clarification',
      clarification: expect.objectContaining({
        reason: 'ambiguous_product_reference',
        candidates: expect.arrayContaining([
          expect.objectContaining({
            name: expect.stringContaining('ASUS TUF'),
          }),
          expect.objectContaining({ name: expect.stringContaining('MSI') }),
        ]),
      }),
    });
  });

  it('keeps every session ledger read scoped to the current roomId only', async () => {
    const resolver = new ProductContextResolver(
      sessionService as any,
      catalogAdapter as any,
    );

    await resolver.resolve({ roomId, userText: 'mẫu MSI ở trên' });

    expect(sessionService.getLastRecommendationLedger).toHaveBeenCalledWith(
      roomId,
    );
    expect(sessionService.getLastRecommendationLedger).not.toHaveBeenCalledWith(
      otherRoomId,
    );
  });
});
