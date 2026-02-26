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
