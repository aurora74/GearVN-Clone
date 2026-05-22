import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Blog, BlogDocument } from '../blog/blog.schema';
import { BlogComment, BlogCommentDocument } from './blog-comment.schema';
import { CreateBlogCommentDto } from './dto/blog-comment.dto';
import { sanitizePlainTextContent } from '../common/validators/content-safety';
import {
  ModerationActor,
  ModerationService,
} from '../moderation/moderation.service';

export interface BlogCommentActor {
  id?: string;
  _id?: string;
  fullName?: string;
  email?: string;
}

const HIDDEN_CONTENT_PLACEHOLDER = 'Nội dung này đã được ẩn bởi Quản trị viên.';

export interface BlogCommentModerationDto {
  action: 'hide' | 'delete';
  reason: string;
}

@Injectable()
export class BlogCommentService {
  constructor(
    @InjectModel(BlogComment.name)
    private readonly blogCommentModel: Model<BlogCommentDocument>,
    @InjectModel(Blog.name)
    private readonly blogModel: Model<BlogDocument>,
    private readonly moderationService: ModerationService,
  ) {}

  private getActorId(actor: BlogCommentActor) {
    const actorId = actor?.id ?? actor?._id;
    if (!actorId) {
      throw new BadRequestException('Missing authenticated actor');
    }
    return String(actorId);
  }

  private assertContent(content?: string) {
    const normalized = sanitizePlainTextContent(content, 'Comment content');
    if (normalized.length > 2000) {
      throw new BadRequestException('Comment content is too long');
    }
    return normalized;
  }

  toPublicComment(comment: BlogCommentDocument | any) {
    if (comment.status === 'deleted') return null;

    const author = comment.authorId;
    const authorId = typeof author === 'object' ? author?._id?.toString() : author?.toString();

    return {
      id: comment._id?.toString(),
      blogId: comment.blogId?.toString(),
      authorId,
      author: {
        displayName:
          typeof author === 'object'
            ? author?.fullName || author?.email || 'Khach hang'
            : 'Khach hang',
        avatarUrl: typeof author === 'object' ? author?.avatarUrl : undefined,
      },
      content:
        comment.status === 'hidden'
          ? HIDDEN_CONTENT_PLACEHOLDER
          : comment.content,
      status: comment.status,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }

  async createComment(
    blogId: string,
    actor: BlogCommentActor,
    dto: CreateBlogCommentDto,
  ) {
    const actorId = this.getActorId(actor);
    const content = this.assertContent(dto.content);

    const blog = await this.blogModel.findById(blogId);
    if (!blog) {
      throw new NotFoundException('Blog not found');
    }
    if (blog.isPublished === false) {
      throw new BadRequestException('Cannot comment on unpublished blog');
    }

    const comment = new this.blogCommentModel({
      blogId,
      authorId: actorId,
      content,
      status: 'visible',
    });

    await comment.save();
    await comment.populate({ path: 'authorId', select: 'fullName email avatarUrl' });
    return this.toPublicComment(comment);
  }

  async listByBlog(blogIdOrSlug: string) {
    const blog = Types.ObjectId.isValid(blogIdOrSlug)
      ? await this.blogModel.findById(blogIdOrSlug)
      : await this.blogModel.findOne({ slug: blogIdOrSlug });

    if (!blog) {
      throw new NotFoundException('Blog not found');
    }
    if (blog.isPublished === false) {
      throw new BadRequestException('Blog not found');
    }

    const comments = await this.blogCommentModel
      .find({ blogId: blog._id?.toString(), status: 'visible' })
      .populate({ path: 'authorId', select: 'fullName email avatarUrl' })
      .sort({ createdAt: -1 })
      .exec();

    return comments.map((comment) => this.toPublicComment(comment)).filter(Boolean);
  }

  async moderateBlogComment(
    commentId: string,
    actor: ModerationActor,
    dto: BlogCommentModerationDto,
  ) {
    const comment = await this.blogCommentModel.findById(commentId);
    if (!comment) throw new NotFoundException('Blog comment not found');

    const reason = this.moderationService.assertModerationReason(dto.reason);
    comment.status = dto.action === 'delete' ? 'deleted' : 'hidden';
    comment.moderationReason = reason;
    comment.moderatedBy = this.getActorId(actor);
    comment.moderatedAt = new Date();

    await comment.save();
    await this.moderationService.recordModerationAudit({
      actor,
      action: dto.action,
      targetType: 'blog-comment',
      targetId: commentId,
      reason,
      metadata: { blogId: comment.blogId?.toString() },
    });

    return this.toPublicComment(comment);
  }
}
