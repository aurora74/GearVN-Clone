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
        content: 'Nội dung này đã được ẩn bởi Moderator.',
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
        content: 'Nội dung này đã được ẩn bởi Moderator.',
        images: [],
      }),
    );
    expect(result[0].replies[0]).not.toHaveProperty('moderationReason');
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
      isArchived: false,
      soldQuantity: { $gt: 0 },
    });
    expect(productModel.find).toHaveBeenNthCalledWith(2, {
      isArchived: false,
      isPublished: true,
      stock: { $gt: 0, $lte: 5 },
    });
    expect(productModel.find).toHaveBeenNthCalledWith(3, {
      isArchived: false,
      isPublished: true,
      stock: { $lte: 0 },
    });
    expect(productModel.countDocuments).toHaveBeenLastCalledWith({
      isArchived: false,
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
