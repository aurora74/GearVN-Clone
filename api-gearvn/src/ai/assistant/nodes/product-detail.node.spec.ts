import { productDetailNode } from './product-detail.node';
import { ReviewSearchClient } from '../adapters/review-search.client';

describe('productDetailNode', () => {
  const catalogDetail = {
    productId: 'lenovo-thinkbook-14-g7-iml',
    name: 'Lenovo ThinkBook 14 G7 IML 21MR006YVN',
    slug: 'lenovo-thinkbook-14-g7-iml-21mr006yvn',
    price: 18_990_000,
    discountPrice: 17_990_000,
    stock: 7,
    category: 'Laptop',
    description: 'Laptop văn phòng mỏng nhẹ cho học tập và công việc.',
    attributes: {
      cpu: 'Intel Core Ultra 5',
      ram: '16GB',
      ssd: '512GB',
    },
    searchMetadata: {
      specsSummary: 'Core Ultra 5, RAM 16GB, SSD 512GB, màn 14 inch',
      semanticTags: ['laptop văn phòng', 'mỏng nhẹ'],
      useCases: ['học tập', 'văn phòng'],
    },
    averageRating: 4.6,
    ratingsCount: 18,
  };

  const catalogAdapter = {
    getProductDetailById: jest.fn(),
  };
  const reviewSearchClient = {
    search: jest.fn(),
  } as unknown as jest.Mocked<ReviewSearchClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    catalogAdapter.getProductDetailById.mockResolvedValue(catalogDetail);
    reviewSearchClient.search.mockResolvedValue([]);
  });

  it('answers review-like detail requests from Mongo catalog facts without default web search', async () => {
    const result = await productDetailNode(
      {
        roomId: 'room-hotfix-detail',
        userText:
          'review chi tiết cho mình con Lenovo ThinkBook 14 G7 IML 21MR006YVN',
        productContext: {
          productId: 'lenovo-thinkbook-14-g7-iml',
          matchSource: 'catalog.name_search',
        },
      },
      {
        catalogAdapter: catalogAdapter as any,
        reviewSearchClient,
      },
    );

    expect(catalogAdapter.getProductDetailById).toHaveBeenCalledWith(
      'lenovo-thinkbook-14-g7-iml',
    );
    expect(reviewSearchClient.search).not.toHaveBeenCalled();
    expect(result.metadata.productDetail).toMatchObject({
      name: catalogDetail.name,
      slug: catalogDetail.slug,
      price: catalogDetail.price,
      discountPrice: catalogDetail.discountPrice,
      stock: catalogDetail.stock,
      category: catalogDetail.category,
      description: catalogDetail.description,
      attributes: catalogDetail.attributes,
      searchMetadata: catalogDetail.searchMetadata,
      averageRating: catalogDetail.averageRating,
      ratingsCount: catalogDetail.ratingsCount,
    });
    expect(result.text).toContain(catalogDetail.name);
    expect(result.text).toContain('không có trong dữ liệu catalog hiện tại');
    expect(result.text).toContain('warranty');
    expect(result.text).toContain('promotion');
    expect(result.text).toContain('benchmark');
    expect(result.text).toContain('public-review');
  });

  it('does not invent missing warranty, promotion, benchmark, or public-review facts', async () => {
    const result = await productDetailNode(
      {
        roomId: 'room-hotfix-detail',
        userText: 'đánh giá chi tiết Lenovo ThinkBook 14 G7 IML',
        productContext: {
          productId: 'lenovo-thinkbook-14-g7-iml',
          matchSource: 'ledger.exact_name',
        },
      },
      {
        catalogAdapter: catalogAdapter as any,
        reviewSearchClient,
      },
    );

    expect(result.text).toMatch(/warranty.*không có trong dữ liệu catalog hiện tại/i);
    expect(result.text).toMatch(/promotion.*không có trong dữ liệu catalog hiện tại/i);
    expect(result.text).toMatch(/benchmark.*không có trong dữ liệu catalog hiện tại/i);
    expect(result.text).toMatch(/public-review.*không có trong dữ liệu catalog hiện tại/i);
    expect(reviewSearchClient.search).not.toHaveBeenCalled();
  });
});
