import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

import { UserRole } from '../auth/enums/user-role.enum';
import { ProductService } from './product.service';

const createProduct = () => ({
  _id: new Types.ObjectId().toString(),
  comments: [
    {
      _id: 'review-1',
      userId: 'customer-1',
      content: 'Tot',
      images: ['https://cdn.test/review.png'],
      rating: 5,
      likes: [],
      replies: [
        {
          _id: 'reply-1',
          userId: 'customer-2',
          content: 'Dong y',
          images: ['https://cdn.test/reply.png'],
          likes: [],
          createdAt: new Date('2026-05-01T00:00:00Z'),
          moderationStatus: 'visible',
        },
      ],
      createdAt: new Date('2026-05-01T00:00:00Z'),
      moderationStatus: 'visible',
    },
    {
      _id: 'review-2',
      userId: 'customer-3',
      content: 'Tam on',
      images: [],
      rating: 3,
      likes: [],
      replies: [],
      createdAt: new Date('2026-05-01T01:00:00Z'),
      moderationStatus: 'visible',
    },
  ],
  averageRating: 4,
  ratingsCount: 2,
  save: jest.fn().mockResolvedValue(undefined),
});

describe('ProductService moderation', () => {
  const actor = { id: 'csr-1', role: UserRole.CSR };
  let product: ReturnType<typeof createProduct>;
  let productModel: { findById: jest.Mock };
  let moderationService: {
    assertModerationReason: jest.Mock;
    recordModerationAudit: jest.Mock;
  };
  let service: ProductService;

  beforeEach(() => {
    product = createProduct();
    productModel = { findById: jest.fn().mockResolvedValue(product) };
    moderationService = {
      assertModerationReason: jest.fn((reason?: string) => {
        const normalized = reason?.trim();
        if (!normalized) throw new BadRequestException('Reason required');
        return normalized;
      }),
      recordModerationAudit: jest.fn().mockResolvedValue(undefined),
    };
    service = new ProductService(
      productModel as any,
      { uploadImage: jest.fn() } as any,
      moderationService as any,
    );
  });

  it('hides a review with an internal reason, public placeholder, and rating recalculation', async () => {
    const result = await service.moderateComment(
      product._id,
      'review-1',
      actor,
      { action: 'hide', reason: 'Vi pham noi quy' },
    );

    expect(product.comments[0]).toEqual(
      expect.objectContaining({
        moderationStatus: 'hidden',
        moderationReason: 'Vi pham noi quy',
        moderatedBy: actor.id,
        moderatedAt: expect.any(Date),
      }),
    );
    expect(product.averageRating).toBe(3);
    expect(product.ratingsCount).toBe(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        content: 'Nội dung này đã được ẩn bởi Quản trị viên.',
        images: [],
      }),
    );
    expect(result[0]).not.toHaveProperty('moderationReason');
    expect(moderationService.recordModerationAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'hide',
        targetType: 'product-review',
        targetId: 'review-1',
        reason: 'Vi pham noi quy',
      }),
    );
  });

  it('deletes a review from public output and recalculates ratings', async () => {
    const result = await service.moderateComment(product._id, 'review-1', actor, {
      action: 'delete',
      reason: 'Spam',
    });

    expect(product.comments[0].moderationStatus).toBe('deleted');
    expect(product.averageRating).toBe(3);
    expect(product.ratingsCount).toBe(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({ _id: 'review-2' }));
  });

  it('hides replies without changing rating aggregates', async () => {
    const result = await service.moderateReply(product._id, 'review-1', 'reply-1', actor, {
      action: 'hide',
      reason: 'Cong kich',
    });

    expect(product.averageRating).toBe(4);
    expect(product.ratingsCount).toBe(2);
    expect(result[0].replies[0]).toEqual(
      expect.objectContaining({
        content: 'Nội dung này đã được ẩn bởi Quản trị viên.',
        images: [],
      }),
    );
    expect(result[0].replies[0]).not.toHaveProperty('moderationReason');
  });
});

describe('ProductService public engagement visibility', () => {
  let productModel: { findOne: jest.Mock; findById: jest.Mock };
  let cloudinaryService: { uploadImage: jest.Mock };
  let service: ProductService;

  beforeEach(() => {
    productModel = { findOne: jest.fn(), findById: jest.fn() };
    cloudinaryService = { uploadImage: jest.fn() };
    service = new ProductService(
      productModel as any,
      cloudinaryService as any,
      {
        assertModerationReason: jest.fn(),
        recordModerationAudit: jest.fn(),
      } as any,
    );
  });

  it('requires a visible product before creating public reviews', async () => {
    const product = createProduct();
    productModel.findOne.mockResolvedValue(product);

    const result = await service.comment(
      product._id,
      'customer-1',
      { rating: 5, content: 'Rat tot' } as any,
      [],
    );

    expect(productModel.findOne).toHaveBeenCalledWith({
      _id: product._id,
      isPublished: { $ne: false },
      isArchived: { $ne: true },
    });
    expect(productModel.findById).not.toHaveBeenCalled();
    expect(product.comments).toHaveLength(3);
    expect(result).toHaveLength(3);
  });

  it('normalizes public review rating before persistence', async () => {
    const product = createProduct();
    productModel.findOne.mockResolvedValue(product);

    await service.comment(
      product._id,
      'customer-4',
      { rating: '4', content: 'Rat tot' } as any,
      [],
    );

    expect(product.comments[product.comments.length - 1].rating).toBe(4);
  });

  it.each([
    ['non-finite', 'not-a-number'],
    ['infinite', 'Infinity'],
    ['too low', 0],
    ['too high', 6],
  ])('rejects %s public review ratings before upload or mutation', async (_, rating) => {
    const product = createProduct();

    await expect(
      service.comment(
        product._id,
        'customer-1',
        { rating, content: 'Rat tot' } as any,
        [{ mimetype: 'image/png', size: 1024, buffer: Buffer.from('x') } as Express.Multer.File],
      ),
    ).rejects.toThrow('Rating must be between 1 and 5');

    expect(productModel.findOne).not.toHaveBeenCalled();
    expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();
    expect(product.comments).toHaveLength(2);
  });

  it('uses visible product lookup for public comment mutations', async () => {
    const scenarios = [
      {
        name: 'toggleLikeComment',
        run: (product: ReturnType<typeof createProduct>) =>
          service.toggleLikeComment(product._id, 'review-1', 'customer-2'),
      },
      {
        name: 'replyComment',
        run: (product: ReturnType<typeof createProduct>) =>
          service.replyComment(product._id, 'review-1', 'customer-2', 'Dong y', []),
      },
      {
        name: 'editComment',
        run: (product: ReturnType<typeof createProduct>) =>
          service.editComment(
            product._id,
            'reply-1',
            'customer-2',
            'Cap nhat',
            [],
            JSON.stringify(['https://cdn.test/reply.png']),
          ),
      },
      {
        name: 'deleteComment',
        run: (product: ReturnType<typeof createProduct>) =>
          service.deleteComment(product._id, 'reply-1', 'customer-2'),
      },
    ];

    for (const scenario of scenarios) {
      const product = createProduct();
      productModel.findOne.mockResolvedValueOnce(product);

      await scenario.run(product);

      expect(productModel.findOne).toHaveBeenLastCalledWith({
        _id: product._id,
        isPublished: { $ne: false },
        isArchived: { $ne: true },
      });
      expect(product.save).toHaveBeenCalled();
    }

    expect(productModel.findById).not.toHaveBeenCalled();
  });

  it('rejects public reviews for hidden products before upload or mutation', async () => {
    productModel.findOne.mockResolvedValue(null);

    await expect(
      service.comment(
        new Types.ObjectId().toString(),
        'customer-1',
        { rating: 5, content: 'Rat tot' } as any,
        [{ mimetype: 'image/png', size: 1024, buffer: Buffer.from('x') } as Express.Multer.File],
      ),
    ).rejects.toThrow('Product not found');

    expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();
  });
});
const makeUpdateBody = (overrides: Record<string, unknown> = {}) => ({
  name: 'Bo mach chu test',
  slug: 'bo-mach-chu-test',
  category: 'mainboard',
  price: 9000000,
  stock: 10,
  attributes: '{}',
  oldImages: JSON.stringify(['https://cdn.test/product.png']),
  ...overrides,
});

describe('ProductService promotion event assignment', () => {
  let productModel: { findById: jest.Mock; findByIdAndUpdate: jest.Mock };
  let service: ProductService;

  beforeEach(() => {
    productModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    service = new ProductService(
      productModel as any,
      { uploadImage: jest.fn() } as any,
      {
        assertModerationReason: jest.fn(),
        recordModerationAudit: jest.fn(),
      } as any,
    );
  });

  it('rejects moving a product from one event to another event', async () => {
    productModel.findById.mockResolvedValue({
      _id: 'product-1',
      event: 'deal-tuan-nay',
    });

    await expect(
      service.update(
        'product-1',
        makeUpdateBody({ event: 'flash-sale', discountPrice: 5400000 }),
        [],
        { role: UserRole.MANAGER },
      ),
    ).rejects.toThrow('already attached to event "deal-tuan-nay"');

    expect(productModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('allows updating sale values for a product already in the same event', async () => {
    const updatedProduct = { _id: 'product-1', event: 'flash-sale' };
    productModel.findById.mockResolvedValue(updatedProduct);
    productModel.findByIdAndUpdate.mockResolvedValue(updatedProduct);

    await expect(
      service.update(
        'product-1',
        makeUpdateBody({
          event: 'flash-sale',
          discountPrice: 5400000,
          discountPercent: 40,
        }),
        [],
        { role: UserRole.MANAGER },
      ),
    ).resolves.toEqual(updatedProduct);

    expect(productModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'product-1',
      expect.objectContaining({
        event: 'flash-sale',
        discountPrice: 5400000,
        discountPercent: 40,
        images: ['https://cdn.test/product.png'],
      }),
      { new: true, runValidators: true },
    );
  });

  it('rejects stock updates from Product & Marketing Staff', async () => {
    productModel.findById.mockResolvedValue({ _id: 'product-1' });

    await expect(
      service.update('product-1', makeUpdateBody({ stock: 12 }), [], {
        role: UserRole.PRODUCT_MARKETING_STAFF,
      }),
    ).rejects.toThrow('Inventory fields require INVENTORY_MANAGE');

    expect(productModel.findById).not.toHaveBeenCalled();
    expect(productModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('allows Manager stock updates through the explicit allowlist', async () => {
    const updatedProduct = { _id: 'product-1', stock: 12 };
    productModel.findById.mockResolvedValue({ _id: 'product-1' });
    productModel.findByIdAndUpdate.mockResolvedValue(updatedProduct);

    await expect(
      service.update('product-1', makeUpdateBody({ stock: 12 }), [], {
        role: UserRole.MANAGER,
      }),
    ).resolves.toEqual(updatedProduct);

    expect(productModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'product-1',
      expect.objectContaining({ stock: 12 }),
      { new: true, runValidators: true },
    );
  });
});

describe('ProductService stock-only updates', () => {
  let productModel: { findByIdAndUpdate: jest.Mock };
  let service: ProductService;

  beforeEach(() => {
    productModel = { findByIdAndUpdate: jest.fn() };

    service = new ProductService(
      productModel as any,
      { uploadImage: jest.fn() } as any,
      {
        assertModerationReason: jest.fn(),
        recordModerationAudit: jest.fn(),
      } as any,
    );
  });

  it('updates only stock without requiring an inventory reason', async () => {
    const updatedProduct = {
      _id: 'product-1',
      name: 'Laptop van phong',
      price: 12000000,
      stock: 18,
    };
    productModel.findByIdAndUpdate.mockResolvedValue(updatedProduct);

    await expect(service.updateStock('product-1', 18, { stock: 18 })).resolves.toEqual(
      updatedProduct,
    );

    expect(productModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'product-1',
      { stock: 18 },
      { new: true, runValidators: true },
    );
  });

  it('rejects negative and non-integer stock values', async () => {
    await expect(service.updateStock('product-1', -1, { stock: -1 })).rejects.toThrow(
      'Invalid stock value',
    );
    await expect(service.updateStock('product-1', 1.5, { stock: 1.5 })).rejects.toThrow(
      'Invalid stock value',
    );

    expect(productModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects catalog fields through stock update', async () => {
    await expect(
      service.updateStock('product-1', 18, {
        stock: 18,
        price: 1000,
        description: 'tamper',
        images: ['https://cdn.test/tamper.png'],
        attributes: { brand: 'tamper' },
        event: 'flash-sale',
        isPublished: false,
      }),
    ).rejects.toThrow('Unknown stock fields are not allowed');

    expect(productModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});


describe('ProductService create stock boundary', () => {
  const file = { buffer: Buffer.from('image') } as Express.Multer.File;
  const createBody = makeUpdateBody();
  let productModel: any;
  let service: ProductService;

  beforeEach(() => {
    productModel = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue(data),
    }));

    service = new ProductService(
      productModel,
      { uploadImage: jest.fn().mockResolvedValue({ secure_url: 'https://cdn.test/new.png' }) } as any,
      {
        assertModerationReason: jest.fn(),
        recordModerationAudit: jest.fn(),
      } as any,
    );
  });

  it('rejects stock on create for Product & Marketing Staff', async () => {
    await expect(
      service.create(createBody, [file], { role: UserRole.PRODUCT_MARKETING_STAFF }),
    ).rejects.toThrow('Inventory fields require INVENTORY_MANAGE');

    expect(productModel).not.toHaveBeenCalled();
  });

  it('allows Manager stock on create', async () => {
    await service.create(createBody, [file], { role: UserRole.MANAGER });

    expect(productModel).toHaveBeenCalledWith(
      expect.objectContaining({
        name: createBody.name,
        stock: createBody.stock,
        images: ['https://cdn.test/new.png'],
      }),
    );
  });
});

describe('ProductService media cleanup', () => {
  let productModel: { findById: jest.Mock; findByIdAndUpdate: jest.Mock };
  let cloudinaryService: { uploadImage: jest.Mock; deleteImage: jest.Mock };
  let service: ProductService;

  beforeEach(() => {
    productModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };
    cloudinaryService = {
      uploadImage: jest.fn(),
      deleteImage: jest.fn().mockResolvedValue({ result: 'ok' }),
    };
    service = new ProductService(
      productModel as any,
      cloudinaryService as any,
      {
        assertModerationReason: jest.fn(),
        recordModerationAudit: jest.fn(),
      } as any,
    );
  });

  it('deletes removed images after product update persistence', async () => {
    const existingProduct = {
      _id: 'product-1',
      images: ['https://cdn.test/keep.png', 'https://cdn.test/remove.png'],
    };
    const updatedProduct = { _id: 'product-1', images: ['https://cdn.test/keep.png'] };
    productModel.findById.mockResolvedValue(existingProduct);
    productModel.findByIdAndUpdate.mockResolvedValue(updatedProduct);

    await expect(
      service.update(
        'product-1',
        makeUpdateBody({ oldImages: JSON.stringify(['https://cdn.test/keep.png']) }),
        [],
        { role: UserRole.MANAGER },
      ),
    ).resolves.toEqual(updatedProduct);

    expect(productModel.findByIdAndUpdate).toHaveBeenCalled();
    expect(cloudinaryService.deleteImage).toHaveBeenCalledWith('https://cdn.test/remove.png');
  });

  it('returns a cleanup warning without rejecting when removed image deletion fails', async () => {
    const existingProduct = {
      _id: 'product-1',
      images: ['https://cdn.test/remove.png'],
    };
    const updatedProduct = { _id: 'product-1', images: [] };
    productModel.findById.mockResolvedValue(existingProduct);
    productModel.findByIdAndUpdate.mockResolvedValue(updatedProduct);
    cloudinaryService.deleteImage.mockRejectedValue(new Error('cloudinary down'));

    await expect(
      service.update(
        'product-1',
        makeUpdateBody({ oldImages: JSON.stringify([]) }),
        [],
        { role: UserRole.MANAGER },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        cleanupWarning: true,
        cleanupFailedAssets: ['https://cdn.test/remove.png'],
      }),
    );
  });

  it('preserves existing images and omits attributes when optional fields are omitted', async () => {
    const existingProduct = {
      _id: 'product-1',
      images: ['https://cdn.test/keep.png'],
      attributes: { brand: 'GearVN' },
    };
    const updatedProduct = {
      _id: 'product-1',
      images: ['https://cdn.test/keep.png', 'https://cdn.test/new.png'],
    };
    const body = makeUpdateBody() as Record<string, unknown>;
    delete body.oldImages;
    delete body.attributes;
    productModel.findById.mockResolvedValue(existingProduct);
    productModel.findByIdAndUpdate.mockResolvedValue(updatedProduct);
    cloudinaryService.uploadImage.mockResolvedValue({
      secure_url: 'https://cdn.test/new.png',
    });

    await expect(
      service.update(
        'product-1',
        body,
        [{ buffer: Buffer.from('image') } as Express.Multer.File],
        { role: UserRole.MANAGER },
      ),
    ).resolves.toEqual(updatedProduct);

    const updateData = productModel.findByIdAndUpdate.mock.calls[0][1];
    expect(updateData.images).toEqual([
      'https://cdn.test/keep.png',
      'https://cdn.test/new.png',
    ]);
    expect(updateData).not.toHaveProperty('attributes');
    expect(cloudinaryService.deleteImage).not.toHaveBeenCalled();
  });
});

describe('ProductService managed listing stock filters', () => {
  const makeListChain = (result: unknown[] = []) => ({
    lean: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(result),
  });

  let productModel: {
    countDocuments: jest.Mock;
    find: jest.Mock;
  };
  let listChain: ReturnType<typeof makeListChain>;
  let service: ProductService;

  beforeEach(() => {
    listChain = makeListChain();
    productModel = {
      countDocuments: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockReturnValue(listChain),
    };

    service = new ProductService(
      productModel as any,
      { uploadImage: jest.fn() } as any,
      {
        assertModerationReason: jest.fn(),
        recordModerationAudit: jest.fn(),
      } as any,
    );
  });

  it('filters active managed products with zero or negative stock', async () => {
    await service.findAll({
      page: 1,
      limit: 20,
      publicOnly: false,
      visibility: 'active',
      stockStatus: 'zero',
    });

    const expectedFilter = {
      isPublished: { $ne: false },
      isArchived: { $ne: true },
      stock: { $lte: 0 },
    };
    expect(productModel.find).toHaveBeenCalledWith(expectedFilter);
    expect(productModel.countDocuments).toHaveBeenCalledWith(expectedFilter);
  });

  it('filters active managed products with low stock', async () => {
    await service.findAll({
      page: 1,
      limit: 20,
      publicOnly: false,
      visibility: 'active',
      stockStatus: 'low',
    });

    const expectedFilter = {
      isPublished: { $ne: false },
      isArchived: { $ne: true },
      stock: { $gt: 0, $lte: 5 },
    };
    expect(productModel.find).toHaveBeenCalledWith(expectedFilter);
    expect(productModel.countDocuments).toHaveBeenCalledWith(expectedFilter);
  });

  it('applies the indexed default sort when no sort is provided', async () => {
    await service.findAll({
      page: 1,
      limit: 20,
      publicOnly: false,
    });

    expect(listChain.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
  });

  it('keeps only allowlisted product sort fields', async () => {
    await service.findAll({
      page: 1,
      limit: 20,
      publicOnly: false,
      sortBy: '-createdAt,__proto__,name,unknown',
    });

    expect(listChain.sort).toHaveBeenCalledWith({ createdAt: -1, name: 1 });
  });

  it('falls back to the default sort when all requested sort fields are unknown', async () => {
    await service.findAll({
      page: 1,
      limit: 20,
      publicOnly: false,
      sortBy: 'category,-event',
    });

    expect(listChain.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
  });
});

describe('ProductService analytics', () => {
  const makeFindChain = (result: unknown[]) => ({
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  });

  let productModel: {
    countDocuments: jest.Mock;
    find: jest.Mock;
  };
  let service: ProductService;

  beforeEach(() => {
    productModel = {
      countDocuments: jest
        .fn()
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(1),
      find: jest
        .fn()
        .mockReturnValueOnce(makeFindChain([{ _id: 'top-1', soldQuantity: 8 }]))
        .mockReturnValueOnce(makeFindChain([{ _id: 'low-1', stock: 5 }]))
        .mockReturnValueOnce(makeFindChain([{ _id: 'out-1', stock: 0 }])),
    };

    service = new ProductService(
      productModel as any,
      { uploadImage: jest.fn() } as any,
      {
        assertModerationReason: jest.fn(),
        recordModerationAudit: jest.fn(),
      } as any,
    );
  });

  it('excludes archived products from top sellers and stock action lists', async () => {
    const result = await service.getProductAnalytics({ lowStockThreshold: 5, limit: 5 });

    expect(productModel.find).toHaveBeenNthCalledWith(1, {
      isArchived: { $ne: true },
      soldQuantity: { $gt: 0 },
    });
    expect(productModel.find).toHaveBeenNthCalledWith(2, {
      isArchived: { $ne: true },
      isPublished: { $ne: false },
      stock: { $gt: 0, $lte: 5 },
    });
    expect(productModel.find).toHaveBeenNthCalledWith(3, {
      isArchived: { $ne: true },
      isPublished: { $ne: false },
      stock: { $lte: 0 },
    });
    expect(productModel.countDocuments).toHaveBeenLastCalledWith({
      isArchived: { $ne: true },
      isPublished: false,
      stock: { $lte: 5 },
    });
    expect(result).toEqual(
      expect.objectContaining({
        topSellers: [{ _id: 'top-1', soldQuantity: 8 }],
        lowStockProducts: [{ _id: 'low-1', stock: 5 }],
        outOfStockProducts: [{ _id: 'out-1', stock: 0 }],
        unpublishedLowStockCount: 1,
      }),
    );
  });
});
