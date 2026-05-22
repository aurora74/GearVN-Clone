import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { UserRole } from '../auth/enums/user-role.enum';
import { BlogCommentService } from './blog-comment.service';

const createCommentModel = () => {
  const model: any = jest.fn().mockImplementation((data) => {
    const comment = {
      ...data,
      _id: new Types.ObjectId(),
      save: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockImplementation(async () => {
        comment.authorId = {
          _id: data.authorId,
          fullName: 'Nguyen Van A',
          email: 'customer@example.com',
          avatarUrl: 'https://cdn.test/avatar.png',
        };
        return comment;
      }),
    };

    return comment;
  });

  model.find = jest.fn();
  model.findById = jest.fn();

  return model;
};

describe('BlogCommentService', () => {
  const blogId = new Types.ObjectId().toString();
  const actor = {
    id: new Types.ObjectId().toString(),
    fullName: 'Nguyen Van A',
    email: 'customer@example.com',
  };

  let commentModel: any;
  let blogModel: any;
  let supportTicketService: { createForProductQuestion: jest.Mock };
  let service: BlogCommentService;

  beforeEach(() => {
    commentModel = createCommentModel();
    blogModel = {
      findById: jest.fn().mockResolvedValue({
        _id: blogId,
        title: 'Tin cong nghe',
        isPublished: true,
      }),
      findOne: jest.fn().mockResolvedValue({
        _id: blogId,
        slug: 'tin-cong-nghe',
        isPublished: true,
      }),
    };
    supportTicketService = {
      createForProductQuestion: jest.fn(),
    };

    service = new BlogCommentService(commentModel, blogModel, {
      assertModerationReason: jest.fn((reason?: string) => {
        const normalized = reason?.trim();
        if (!normalized) throw new BadRequestException('Reason required');
        return normalized;
      }),
      recordModerationAudit: jest.fn().mockResolvedValue(undefined),
    } as any);
  });

  it('creates a flat visible blog comment without creating a support ticket', async () => {
    const result = await service.createComment(blogId, actor, {
      content: 'Bai viet huu ich qua.',
    });

    expect(blogModel.findById).toHaveBeenCalledWith(blogId);
    expect(commentModel).toHaveBeenCalledWith(
      expect.objectContaining({
        blogId,
        authorId: actor.id,
        content: 'Bai viet huu ich qua.',
        status: 'visible',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        blogId,
        authorId: actor.id,
        author: expect.objectContaining({ displayName: actor.fullName }),
        content: 'Bai viet huu ich qua.',
        status: 'visible',
      }),
    );
    expect(commentModel.mock.results[0].value.populate).toHaveBeenCalledWith({
      path: 'authorId',
      select: 'fullName email avatarUrl',
    });
    expect(result).not.toHaveProperty('ticketId');
    expect(supportTicketService.createForProductQuestion).not.toHaveBeenCalled();
  });

  it('rejects empty or unsafe content before persistence', async () => {
    await expect(
      service.createComment(blogId, actor, { content: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.createComment(blogId, actor, {
        content: '<script>alert("xss")</script>',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(commentModel).not.toHaveBeenCalled();
  });

  it('lists visible public comments by blog slug', async () => {
    const exec = jest.fn().mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        blogId,
        authorId: {
          _id: actor.id,
          fullName: actor.fullName,
          email: actor.email,
          avatarUrl: 'https://cdn.test/avatar.png',
        },
        content: 'Rat dang doc.',
        status: 'visible',
        createdAt: new Date('2026-05-01T00:00:00Z'),
        updatedAt: new Date('2026-05-01T00:00:00Z'),
      },
    ]);
    const sort = jest.fn().mockReturnValue({ exec });
    const populate = jest.fn().mockReturnValue({ sort });
    commentModel.find.mockReturnValue({ populate });

    const result = await service.listByBlog('tin-cong-nghe');

    expect(blogModel.findOne).toHaveBeenCalledWith({ slug: 'tin-cong-nghe' });
    expect(commentModel.find).toHaveBeenCalledWith({
      blogId,
      status: 'visible',
    });
    expect(result[0]).toEqual(
      expect.objectContaining({
        content: 'Rat dang doc.',
        author: expect.objectContaining({ displayName: actor.fullName }),
      }),
    );
    expect(result[0]).not.toHaveProperty('moderationReason');
  });

  it('throws when commenting on a missing blog', async () => {
    blogModel.findById.mockResolvedValue(null);

    await expect(
      service.createComment(new Types.ObjectId().toString(), actor, {
        content: 'Hello',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('hides a blog comment with the neutral placeholder and no reason leak', async () => {
    const comment = {
      _id: new Types.ObjectId(),
      blogId,
      authorId: actor.id,
      content: 'Noi dung can an',
      status: 'visible',
      save: jest.fn().mockResolvedValue(undefined),
    };
    commentModel.findById.mockResolvedValue(comment);

    const result = await service.moderateBlogComment(comment._id.toString(), {
      id: new Types.ObjectId().toString(),
      role: UserRole.CSR,
    }, {
      action: 'hide',
      reason: 'Noi dung vi pham',
    });

    expect(comment).toEqual(
      expect.objectContaining({
        status: 'hidden',
        moderationReason: 'Noi dung vi pham',
        moderatedBy: expect.any(String),
        moderatedAt: expect.any(Date),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        content: 'Nội dung này đã được ẩn bởi Quản trị viên.',
        status: 'hidden',
      }),
    );
    expect(result).not.toHaveProperty('moderationReason');
  });

  it('deletes a blog comment from public output', async () => {
    const comment = {
      _id: new Types.ObjectId(),
      blogId,
      authorId: actor.id,
      content: 'Can xoa',
      status: 'visible',
      save: jest.fn().mockResolvedValue(undefined),
    };
    commentModel.findById.mockResolvedValue(comment);

    await service.moderateBlogComment(comment._id.toString(), {
      id: new Types.ObjectId().toString(),
      role: UserRole.MANAGER,
    }, {
      action: 'delete',
      reason: 'Spam',
    });

    expect(comment.status).toBe('deleted');
    expect(service.toPublicComment(comment as any)).toBeNull();
  });
});
