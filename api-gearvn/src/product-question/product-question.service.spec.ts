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
  let connection: any;
  let session: any;
  let cloudinaryService: { uploadImage: jest.Mock; deleteImage: jest.Mock };
  let supportTicketService: jest.Mocked<Pick<SupportTicketService, 'createForProductQuestion'>>;
  let service: ProductQuestionService;
  let moderationService: {
    assertModerationReason: jest.Mock;
    recordModerationAudit: jest.Mock;
  };

  beforeEach(() => {
    questionModel = createQuestionModel();
    const product = {
      _id: productId,
      name: 'Laptop gaming',
      slug: 'laptop-gaming',
      averageRating: 4.5,
      ratingsCount: 12,
    };
    productModel = {
      findById: jest.fn().mockResolvedValue(product),
      findOne: jest.fn().mockResolvedValue(product),
    };
    session = {
      withTransaction: jest.fn(async (callback: () => Promise<void>) => callback()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    connection = {
      startSession: jest.fn().mockResolvedValue(session),
    };
    cloudinaryService = {
      uploadImage: jest.fn().mockResolvedValue({ secure_url: 'https://cdn.test/qna.png' }),
      deleteImage: jest.fn().mockResolvedValue({ result: 'ok' }),
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
      connection as any,
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

    expect(productModel.findOne).toHaveBeenCalledWith({
      _id: productId,
      isPublished: { $ne: false },
      isArchived: { $ne: true },
    });
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
        productSlug: 'laptop-gaming',
      }),
      { session },
    );
    const savedQuestion = questionModel.mock.results[0].value;
    expect(connection.startSession).toHaveBeenCalledTimes(1);
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(savedQuestion.save).toHaveBeenCalledWith({ session });
    expect(savedQuestion.save).toHaveBeenCalledTimes(2);
    expect(session.endSession).toHaveBeenCalledTimes(1);
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

  it('requires a visible product before listing public questions', async () => {
    const question = {
      _id: new Types.ObjectId(),
      productId,
      authorId: actor.id,
      content: 'Con hang khong?',
      images: [],
      comments: [],
      publicStatus: 'visible',
    };
    const query = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([question]),
    };
    questionModel.find.mockReturnValue(query);

    const result = await service.listByProduct(productId);

    expect(productModel.findOne).toHaveBeenCalledWith({
      _id: productId,
      isPublished: { $ne: false },
      isArchived: { $ne: true },
    });
    expect(questionModel.find).toHaveBeenCalledWith({ productId, publicStatus: 'visible' });
    expect(result).toHaveLength(1);
  });

  it('rejects public question creation for hidden products before upload or ticket creation', async () => {
    productModel.findOne.mockResolvedValueOnce(null);

    await expect(
      service.createQuestion(
        productId,
        actor,
        { content: 'May nay con khong?' },
        [{ mimetype: 'image/png', size: 1024, buffer: Buffer.from('x') } as Express.Multer.File],
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();
    expect(connection.startSession).not.toHaveBeenCalled();
    expect(supportTicketService.createForProductQuestion).not.toHaveBeenCalled();
  });

  it('cleans up uploaded images and rethrows the original error when ticket creation fails', async () => {
    const ticketError = new Error('ticket down');
    const cleanupError = new Error('cloudinary down');
    supportTicketService.createForProductQuestion.mockRejectedValueOnce(ticketError);
    cloudinaryService.deleteImage.mockRejectedValueOnce(cleanupError);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      await expect(
        service.createQuestion(
          productId,
          actor,
          { content: 'Can tu van them' },
          [{ mimetype: 'image/png', size: 1024, buffer: Buffer.from('x') } as Express.Multer.File],
        ),
      ).rejects.toBe(ticketError);

      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to delete orphaned product question image',
        expect.objectContaining({
          url: 'https://cdn.test/qna.png',
          error: cleanupError,
        }),
      );
    } finally {
      warnSpy.mockRestore();
    }

    expect(cloudinaryService.uploadImage).toHaveBeenCalledTimes(1);
    expect(cloudinaryService.deleteImage).toHaveBeenCalledWith('https://cdn.test/qna.png');
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
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
        author: expect.objectContaining({ displayName: actor.fullName }),
        authorRoleLabel: 'Customer',
        content: 'Minh cung can biet thong tin nay.',
      }),
    );
    expect(afterProduct.averageRating).toBe(beforeProduct.averageRating);
    expect(afterProduct.ratingsCount).toBe(beforeProduct.ratingsCount);
  });

  it('rejects follow-up comments on moderated questions before upload or mutation', async () => {
    const question = {
      _id: new Types.ObjectId(),
      productId,
      publicStatus: 'hidden',
      comments: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    questionModel.findById.mockResolvedValue(question);

    await expect(
      service.addComment(
        question._id.toString(),
        actor,
        { content: 'Minh hoi them' },
        [{ mimetype: 'image/png', size: 1024, buffer: Buffer.from('x') } as Express.Multer.File],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();
    expect(question.comments).toHaveLength(0);
    expect(question.save).not.toHaveBeenCalled();
  });

  it('rejects customer follow-up comments when parent product is hidden before upload or mutation', async () => {
    const question = {
      _id: new Types.ObjectId(),
      productId,
      comments: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    questionModel.findById.mockResolvedValue(question);
    productModel.findOne.mockResolvedValueOnce(null);

    await expect(
      service.addComment(
        question._id.toString(),
        actor,
        { content: 'Minh hoi them' },
        [{ mimetype: 'image/png', size: 1024, buffer: Buffer.from('x') } as Express.Multer.File],
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(productModel.findOne).toHaveBeenCalledWith({
      _id: productId,
      isPublished: { $ne: false },
      isArchived: { $ne: true },
    });
    expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();
    expect(question.comments).toHaveLength(0);
    expect(question.save).not.toHaveBeenCalled();
  });

  it('stores moderator answers with public label even when parent product is hidden', async () => {
    const question = {
      _id: new Types.ObjectId(),
      productId,
      comments: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    questionModel.findById.mockResolvedValue(question);
    productModel.findOne.mockResolvedValueOnce(null);

    const result = await service.answerQuestion(
      question._id.toString(),
      {
        ...actor,
        role: UserRole.CSR,
        id: new Types.ObjectId().toString(),
      },
      {
        content: 'San pham nay nang cap RAM toi da 32GB.',
      },
    );

    expect(productModel.findOne).not.toHaveBeenCalled();
    expect(result!.comments[0]).toEqual(
      expect.objectContaining({
        author: expect.objectContaining({ displayName: 'Quản trị viên' }),
        authorRoleLabel: 'Quản trị viên',
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

  it('uses populated customer account names over stored generic customer labels', () => {
    const question = {
      _id: new Types.ObjectId(),
      productId,
      authorId: { _id: actor.id, fullName: actor.fullName, email: actor.email },
      content: 'Con hang khong?',
      images: [],
      comments: [
        {
          _id: new Types.ObjectId().toString(),
          authorId: { _id: actor.id, fullName: actor.fullName, email: actor.email },
          authorDisplayName: 'Customer',
          authorRoleLabel: 'Customer',
          isModerator: false,
          content: 'Minh muon hoi them.',
          images: [],
          moderationStatus: 'visible',
          createdAt: new Date('2026-05-01T00:00:00Z'),
        },
      ],
      publicStatus: 'visible',
      createdAt: new Date('2026-05-01T00:00:00Z'),
      updatedAt: new Date('2026-05-01T00:00:00Z'),
    };

    const result = service.toPublicQuestion(question as any);

    expect(result?.comments[0]).toEqual(
      expect.objectContaining({
        author: expect.objectContaining({ displayName: actor.fullName }),
        authorRoleLabel: 'Customer',
      }),
    );
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
        content: 'Nội dung này đã được ẩn bởi Quản trị viên.',
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
        content: 'Nội dung này đã được ẩn bởi Quản trị viên.',
        images: [],
      }),
    );
    expect(result?.comments[0]).not.toHaveProperty('moderationReason');
  });
});
