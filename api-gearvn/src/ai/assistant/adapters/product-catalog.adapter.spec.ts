import { Types } from 'mongoose';

import { ProductCatalogAdapter } from './product-catalog.adapter';

describe('ProductCatalogAdapter catalog detail lookup', () => {
  const validProductId = new Types.ObjectId().toString();
  let productModel: any;
  let findChain: {
    select: jest.Mock;
    limit: jest.Mock;
    lean: jest.Mock;
    exec: jest.Mock;
  };
  let findOneChain: {
    select: jest.Mock;
    lean: jest.Mock;
    exec: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    findChain = {
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    findOneChain = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    };
    productModel = {
      find: jest.fn().mockReturnValue(findChain),
      findOne: jest.fn().mockReturnValue(findOneChain),
    };
  });

  it('loads published product detail by ObjectId with the D-02 projection allowlist', async () => {
    findOneChain.exec.mockResolvedValue({
      _id: validProductId,
      name: 'Laptop ASUS TUF Gaming A15 FA506NCG-HN184W',
      slug: 'laptop-asus-tuf-gaming-a15-fa506ncg-hn184w',
      price: 21_990_000,
      discountPrice: 20_990_000,
      stock: 3,
      category: 'Laptop',
      description: 'Gaming laptop',
      attributes: { cpu: 'Ryzen 5' },
      searchMetadata: { specsSummary: 'Ryzen 5, RTX 3050, RAM 16GB' },
      averageRating: 4.6,
      ratingsCount: 12,
      comments: [{ moderationStatus: 'visible', rating: 5 }],
    });

    const adapter = new ProductCatalogAdapter({} as any, productModel);
    const result = await adapter.getProductDetailById(validProductId);

    expect(productModel.findOne).toHaveBeenCalledWith({
      _id: validProductId,
      isPublished: true,
      isArchived: { $ne: true },
    });
    expect(findOneChain.select).toHaveBeenCalledWith(
      expect.stringContaining(
        'description attributes searchMetadata comments averageRating ratingsCount',
      ),
    );
    expect(findOneChain.lean).toHaveBeenCalled();
    expect(findOneChain.exec).toHaveBeenCalled();
    expect(result).toMatchObject({
      productId: validProductId,
      name: 'Laptop ASUS TUF Gaming A15 FA506NCG-HN184W',
      specsSummary: 'Ryzen 5, RTX 3050, RAM 16GB',
      reviewSignals: expect.objectContaining({ visibleReviewCount: 1 }),
    });
  });

  it('rejects invalid ObjectIds without querying MongoDB', async () => {
    const adapter = new ProductCatalogAdapter({} as any, productModel);

    await expect(adapter.getProductDetailById('not-an-object-id')).resolves.toBeNull();

    expect(productModel.findOne).not.toHaveBeenCalled();
  });

  it('loads snapshots through the customer-visible product filter', async () => {
    const hiddenProductId = new Types.ObjectId().toString();
    findChain.exec.mockResolvedValue([
      {
        _id: validProductId,
        name: 'Laptop ASUS TUF Gaming A15 FA506NCG-HN184W',
        slug: 'laptop-asus-tuf-gaming-a15-fa506ncg-hn184w',
        price: 21_990_000,
        discountPrice: 20_990_000,
        stock: 3,
        category: 'Laptop',
        isPublished: true,
        isArchived: false,
      },
    ]);

    const adapter = new ProductCatalogAdapter({} as any, productModel);
    const result = await adapter.getSnapshotsByIds([
      validProductId,
      hiddenProductId,
    ]);

    expect(productModel.find).toHaveBeenCalledWith({
      _id: { $in: [validProductId, hiddenProductId] },
      isPublished: true,
      isArchived: { $ne: true },
    });
    expect(findChain.select).toHaveBeenCalledWith(
      expect.stringContaining('isPublished isArchived'),
    );
    expect(findChain.lean).toHaveBeenCalled();
    expect(findChain.exec).toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({
        productId: validProductId,
        isPublished: true,
        isArchived: false,
      }),
    ]);
  });

  it('searches by escaped name, slug, and normalized name with bounded limit', async () => {
    findChain.exec.mockResolvedValue([
      {
        _id: validProductId,
        name: 'Lenovo ThinkBook 14 G7 IML 21MR006YVN',
        slug: 'lenovo-thinkbook-14-g7-iml-21mr006yvn',
        price: 18_990_000,
        discountPrice: 0,
        stock: 5,
        category: 'Laptop',
        searchMetadata: {
          normalizedName: 'lenovo thinkbook 14 g7 iml 21mr006yvn',
          specsSummary: 'Intel Core Ultra, RAM 16GB, SSD 512GB',
        },
      },
    ]);

    const adapter = new ProductCatalogAdapter({} as any, productModel);
    const result = await adapter.findProductDetailsByNameOrSlug(
      'Lenovo ThinkBook 14 (G7)',
      25,
    );

    expect(productModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        isPublished: true,
        isArchived: { $ne: true },
        $or: expect.arrayContaining([
          expect.objectContaining({ name: expect.any(RegExp) }),
          expect.objectContaining({ slug: expect.any(RegExp) }),
          expect.objectContaining({
            'searchMetadata.normalizedName': expect.any(RegExp),
          }),
        ]),
      }),
    );
    expect(String(productModel.find.mock.calls[0][0].$or[0].name)).toContain(
      '\\(G7\\)',
    );
    expect(findChain.select).toHaveBeenCalledWith(
      expect.stringContaining(
        'description attributes searchMetadata comments averageRating ratingsCount',
      ),
    );
    expect(findChain.limit).toHaveBeenCalledWith(10);
    expect(findChain.lean).toHaveBeenCalled();
    expect(findChain.exec).toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({
        productId: validProductId,
        slug: 'lenovo-thinkbook-14-g7-iml-21mr006yvn',
        specsSummary: 'Intel Core Ultra, RAM 16GB, SSD 512GB',
      }),
    ]);
  });
});
