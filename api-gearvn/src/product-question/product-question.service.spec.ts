import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { UserRole } from '../auth/enums/user-role.enum';
import { ProductQuestionService } from './product-question.service';
import { SupportTicketService } from '../support-ticket/support-ticket.service';

const createQuestionModel = () => {
  const model: any = jest.fn().mockImplementation((data) => ({
    ...data,
    _id: new Types.ObjectId(),
    comments: data.comments ?? [],
    save: jest.fn().mockResolvedValue(undefined),
  }));

  model.find = jest.fn();
  model.findById = jest.fn();
  model.findByIdAndUpdate = jest.fn();

  return model;
};

describe('ProductQuestionService', () => {
  const productId = new Types.ObjectId().toString();
  const actor = {
    id: new Types.ObjectId().toString(),
    role: UserRole.CUSTOMER,
    fullName: 'Nguyen Van A',
    email: 'customer@example.com',
  };

  let questionModel: any;
  let productModel: any;
  let cloudinaryService: { uploadImage: jest.Mock };
  let supportTicketService: jest.Mocked<Pick<SupportTicketService, 'createForProductQuestion'>>;
  let service: ProductQuestionService;
  let moderationService: {
    assertModerationReason: jest.Mock;
    recordModerationAudit: jest.Mock;
  };

  beforeEach(() => {
    questionModel = createQuestionModel();
    productModel = {
      findById: jest.fn().mockResolvedValue({
        _id: productId,
        name: 'Laptop gaming',
        averageRating: 4.5,
        ratingsCount: 12,
      }),
    };
    cloudinaryService = {
      uploadImage: jest.fn().mockResolvedValue({ secure_url: 'https://cdn.test/qna.png' }),
    };
    supportTicketService = {
      createForProductQuestion: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        status: 'new',
        sourceType: 'product_qna',
      }),
    };
    moderationService = {
      assertModerationReason: jest.fn((reason?: string) => {
        const normalized = reason?.trim();
        if (!normalized) throw new BadRequestException('Reason required');
        return normalized;
      }),
      recordModerationAudit: jest.fn().mockResolvedValue(undefined),
    };
    service = new ProductQuestionService(
      questionModel,
      productModel,
      cloudinaryService as any,
      supportTicketService as any,
      moderationService as any,
    );
  });

  it('creates a question outside product comments and links exactly one product_qna ticket', async () => {
    const result = await service.createQuestion(
      productId,
      actor,
      { content: 'May nay co nang cap RAM duoc khong?' },
      [
        {
          mimetype: 'image/png',
          size: 1024,
          buffer: Buffer.from('image'),
        } as Express.Multer.File,
      ],
    );

    expect(productModel.findById).toHaveBeenCalledWith(productId);
    expect(cloudinaryService.uploadImage).toHaveBeenCalledTimes(1);
    expect(questionModel).toHaveBeenCalledWith(
      expect.objectContaining({
        productId,
        authorId: actor.id,
        content: 'May nay co nang cap RAM duoc khong?',
        images: ['https://cdn.test/qna.png'],
        comments: [],
        publicStatus: 'visible',
      }),
    );
    expect(supportTicketService.createForProductQuestion).toHaveBeenCalledTimes(1);
    expect(supportTicketService.createForProductQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: expect.any(String),
        productId,
        customerId: actor.id,
        contextLabel: 'Laptop gaming',
      }),
    );
    expect(productModel.findById.mock.results[0].value).resolves.toEqual(
      expect.not.objectContaining({ comments: expect.any(Array) }),
    );
    expect(result.ticket).toEqual(expect.objectContaining({ status: 'new' }));
  });

  it('rejects empty content and invalid images before ticket creation', async () => {
    await expect(
      service.createQuestion(
        productId,
        actor,
        { content: '   ' },
        [{ mimetype: 'application/pdf', size: 1, buffer: Buffer.from('x') } as Express.Multer.File],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(supportTicketService.createForProductQuestion).not.toHaveBeenCalled();
  });

  it('adds public follow-up comments without touching product ratings', async () => {
    const question = {
      _id: new Types.ObjectId(),
      productId,
      comments: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    questionModel.findById.mockResolvedValue(question);

    const beforeProduct = await productModel.findById(productId);
    const result = await service.addComment(question._id.toString(), actor, {
      content: 'Minh cung can biet thong tin nay.',
    });
    const afterProduct = await productModel.findById(productId);

    expect(result!.comments).toHaveLength(1);
    expect(result!.comments[0]).toEqual(
      expect.objectContaining({
        authorId: actor.id,
        authorRoleLabel: 'Customer',
        content: 'Minh cung can biet thong tin nay.',
      }),
    );
    expect(afterProduct.averageRating).toBe(beforeProduct.averageRating);
    expect(afterProduct.ratingsCount).toBe(beforeProduct.ratingsCount);
  });

  it('stores moderator answers with public Moderator label', async () => {
    const question = {
      _id: new Types.ObjectId(),
      productId,
      comments: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    questionModel.findById.mockResolvedValue(question);

    const result = await service.answerQuestion(question._id.toString(), {
      ...actor,
      role: UserRole.CSR,
      id: new Types.ObjectId().toString(),
    }, {
      content: 'San pham nay nang cap RAM toi da 32GB.',
    });

    expect(result!.comments[0]).toEqual(
      expect.objectContaining({
        authorRoleLabel: 'Moderator',
        isModerator: true,
      }),
    );
  });

  it('returns public question data without internal ticket metadata beyond ticket id', async () => {
    const question = {
      _id: new Types.ObjectId(),
      productId,
      authorId: { _id: actor.id, fullName: actor.fullName, email: actor.email },
      content: 'Con hang khong?',
      images: [],
      comments: [],
      publicStatus: 'visible',
      ticketId: new Types.ObjectId(),
      createdAt: new Date('2026-05-01T00:00:00Z'),
      updatedAt: new Date('2026-05-01T00:00:00Z'),
    };

    expect(service.toPublicQuestion(question as any)).toEqual(
      expect.objectContaining({
        content: 'Con hang khong?',
        author: expect.objectContaining({ displayName: actor.fullName }),
        ticketId: question.ticketId.toString(),
      }),
    );
    expect(service.toPublicQuestion(question as any)).not.toHaveProperty('metadata');
  });

  it('throws not found when adding a comment to a missing question', async () => {
    questionModel.findById.mockResolvedValue(null);

    await expect(
      service.addComment(new Types.ObjectId().toString(), actor, { content: 'Hello' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('hides a question with the neutral public placeholder and no internal reason leak', async () => {
    const question = {
      _id: new Types.ObjectId(),
      productId,
      authorId: actor.id,
      content: 'Noi dung can an',
      images: ['https://cdn.test/qna.png'],
      comments: [],
      publicStatus: 'visible',
      save: jest.fn().mockResolvedValue(undefined),
    };
    questionModel.findById.mockResolvedValue(question);

    const result = await service.moderateQuestion(question._id.toString(), {
      id: new Types.ObjectId().toString(),
      role: UserRole.CSR,
    }, {
      action: 'hide',
      reason: 'Noi dung vi pham',
    });

    expect(question).toEqual(
      expect.objectContaining({
        moderationStatus: 'hidden',
        moderationReason: 'Noi dung vi pham',
        moderatedBy: expect.any(String),
        moderatedAt: expect.any(Date),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        content: 'Nội dung này đã được ẩn bởi Moderator.',
        images: [],
      }),
    );
    expect(result).not.toHaveProperty('moderationReason');
  });

  it('deletes a question from public lists', async () => {
    const question: any = {
      _id: new Types.ObjectId(),
      productId,
      authorId: actor.id,
      content: 'Can xoa',
      images: [],
      comments: [],
      publicStatus: 'visible',
      save: jest.fn().mockResolvedValue(undefined),
    };
    questionModel.findById.mockResolvedValue(question);

    await service.moderateQuestion(question._id.toString(), {
      id: new Types.ObjectId().toString(),
      role: UserRole.MANAGER,
    }, {
      action: 'delete',
      reason: 'Spam',
    });

    expect(question.moderationStatus).toBe('deleted');
    expect(service.toPublicQuestion(question as any)).toBeNull();
  });

  it('hides a question follow-up with the neutral placeholder', async () => {
    const commentId = new Types.ObjectId().toString();
    const question = {
      _id: new Types.ObjectId(),
      productId,
      authorId: actor.id,
      content: 'Cau hoi',
      images: [],
      publicStatus: 'visible',
      comments: [
        {
          _id: commentId,
          authorId: actor.id,
          authorRoleLabel: 'Customer',
          isModerator: false,
          content: 'Trao doi them',
          images: ['https://cdn.test/comment.png'],
          moderationStatus: 'visible',
          createdAt: new Date(),
        },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    };
    questionModel.findById.mockResolvedValue(question);

    const result = await service.moderateQuestionComment(
      question._id.toString(),
      commentId,
      { id: new Types.ObjectId().toString(), role: UserRole.CSR },
      { action: 'hide', reason: 'Khong phu hop' },
    );

    expect(result?.comments[0]).toEqual(
      expect.objectContaining({
        content: 'Nội dung này đã được ẩn bởi Moderator.',
        images: [],
      }),
    );
    expect(result?.comments[0]).not.toHaveProperty('moderationReason');
  });
});
