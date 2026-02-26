import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { UserRole } from '../auth/enums/user-role.enum';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Product, ProductDocument } from '../product/product.schema';
import { SupportTicketService } from '../support-ticket/support-ticket.service';
import { sanitizePlainTextContent } from '../common/validators/content-safety';
import { validateImageUploads } from '../common/validators/upload-validator';
import {
  ModerationActor,
  ModerationService,
} from '../moderation/moderation.service';
import {
  ProductQuestion,
  ProductQuestionDocument,
  ProductQuestionRoleLabel,
} from './product-question.schema';
import {
  AddProductQuestionCommentDto,
  CreateProductQuestionDto,
} from './dto/product-question.dto';

export interface ProductQuestionActor {
  id?: string;
  _id?: string;
  role?: UserRole;
  fullName?: string;
  email?: string;
}

const MAX_IMAGES = 3;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const HIDDEN_CONTENT_PLACEHOLDER = 'Nội dung này đã được ẩn bởi Moderator.';

export interface ProductQuestionModerationDto {
  action: 'hide' | 'delete';
  reason: string;
}

@Injectable()
export class ProductQuestionService {
  constructor(
    @InjectModel(ProductQuestion.name)
    private readonly productQuestionModel: Model<ProductQuestionDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly supportTicketService: SupportTicketService,
    private readonly moderationService: ModerationService,
  ) {}

  private getActorId(actor: ProductQuestionActor) {
    const actorId = actor?.id ?? actor?._id;
    if (!actorId) {
      throw new BadRequestException('Missing authenticated actor');
    }
    return String(actorId);
  }

  private assertContent(content?: string) {
    const normalized = sanitizePlainTextContent(content, 'Question content');
    if (normalized.length > 2000) {
      throw new BadRequestException('Question content is too long');
    }
    return normalized;
  }

  private assertImages(files: Express.Multer.File[] = []) {
    validateImageUploads(files, {
      maxFiles: MAX_IMAGES,
      maxFileSizeBytes: MAX_IMAGE_SIZE,
    });
  }

  private getRoleLabel(actor: ProductQuestionActor): {
    authorRoleLabel: ProductQuestionRoleLabel;
    isModerator: boolean;
  } {
    const isModerator =
      actor.role === UserRole.CSR || actor.role === UserRole.MANAGER;

    return {
      authorRoleLabel: isModerator ? 'Moderator' : 'Customer',
      isModerator,
    };
  }

  private async uploadImages(files: Express.Multer.File[] = []) {
    this.assertImages(files);
    if (!files.length) return [];

    const uploadedImages = await Promise.all(
      files.map((file) => this.cloudinaryService.uploadImage(file, 'product-qna')),
    );

    return uploadedImages.map((image) => image.secure_url);
  }

  toPublicQuestion(question: ProductQuestionDocument | any) {
    const status = question.moderationStatus ?? question.publicStatus ?? 'visible';
    if (status === 'deleted') return null;

    const author = question.authorId;
    const authorId = typeof author === 'object' ? author?._id?.toString() : author?.toString();

    return {
      id: question._id?.toString(),
      productId: question.productId?.toString(),
      authorId,
      author: {
        displayName:
          typeof author === 'object'
            ? author?.fullName || author?.email || 'Khach hang'
            : 'Khach hang',
      },
      content: status === 'hidden' ? HIDDEN_CONTENT_PLACEHOLDER : question.content,
      images: status === 'hidden' ? [] : (question.images ?? []),
      comments: (question.comments ?? [])
        .map((comment) => this.toPublicQuestionComment(comment))
        .filter(Boolean),
      publicStatus: status,
      ticketId: question.ticketId?.toString(),
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  }

  private toPublicQuestionComment(comment: any) {
    const status = comment.moderationStatus ?? 'visible';
    if (status === 'deleted') return null;

    return {
      id: comment._id?.toString(),
      authorId: comment.authorId?.toString(),
      authorRoleLabel: comment.authorRoleLabel,
      isModerator: comment.isModerator,
      content: status === 'hidden' ? HIDDEN_CONTENT_PLACEHOLDER : comment.content,
      images: status === 'hidden' ? [] : (comment.images ?? []),
      createdAt: comment.createdAt,
    };
  }

  async listByProduct(productId: string) {
    const questions = await this.productQuestionModel
      .find({ productId, publicStatus: 'visible' })
      .populate({ path: 'authorId', select: 'fullName email avatarUrl' })
      .sort({ createdAt: -1 });

    return questions.map((question) => this.toPublicQuestion(question)).filter(Boolean);
  }

  async createQuestion(
    productId: string,
    actor: ProductQuestionActor,
    dto: CreateProductQuestionDto,
    files: Express.Multer.File[] = [],
  ) {
    const actorId = this.getActorId(actor);
    const content = this.assertContent(dto.content);
    this.assertImages(files);

    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const images = await this.uploadImages(files);
    const question = new this.productQuestionModel({
      productId,
      authorId: actorId,
      content,
      images,
      comments: [],
      publicStatus: 'visible',
      moderationStatus: 'visible',
    });

    await question.save();

    const ticket = await this.supportTicketService.createForProductQuestion({
      questionId: question._id.toString(),
      productId,
      customerId: actorId,
      contextLabel: product.name,
    });

    question.ticketId = ticket._id.toString();
    await question.save();

    return {
      question: this.toPublicQuestion(question),
      ticket,
    };
  }

  async addComment(
    questionId: string,
    actor: ProductQuestionActor,
    dto: AddProductQuestionCommentDto,
    files: Express.Multer.File[] = [],
  ) {
    const question = await this.productQuestionModel.findById(questionId);
    if (!question) {
      throw new NotFoundException('Product question not found');
    }

    const content = this.assertContent(dto.content);
    const images = await this.uploadImages(files);
    const roleLabel = this.getRoleLabel(actor);

    question.comments.push({
      _id: new Types.ObjectId().toString(),
      authorId: this.getActorId(actor),
      ...roleLabel,
      content,
      images,
      createdAt: new Date(),
      moderationStatus: 'visible',
    });

    await question.save();
    return this.toPublicQuestion(question);
  }

  async answerQuestion(
    questionId: string,
    actor: ProductQuestionActor,
    dto: AddProductQuestionCommentDto,
    files: Express.Multer.File[] = [],
  ) {
    if (actor.role !== UserRole.CSR && actor.role !== UserRole.MANAGER) {
      throw new BadRequestException('Only moderators can answer questions');
    }

    return this.addComment(questionId, actor, dto, files);
  }

  async moderateQuestion(
    questionId: string,
    actor: ModerationActor,
    dto: ProductQuestionModerationDto,
  ) {
    const question = await this.productQuestionModel.findById(questionId);
    if (!question) throw new NotFoundException('Product question not found');

    const reason = this.moderationService.assertModerationReason(dto.reason);
    const status = dto.action === 'delete' ? 'deleted' : 'hidden';
    question.publicStatus = status;
    question.moderationStatus = status;
    question.moderationReason = reason;
    question.moderatedBy = this.getActorId(actor);
    question.moderatedAt = new Date();

    await question.save();
    await this.moderationService.recordModerationAudit({
      actor,
      action: dto.action,
      targetType: 'product-question',
      targetId: questionId,
      reason,
      metadata: { productId: question.productId?.toString() },
    });

    return this.toPublicQuestion(question);
  }

  async moderateQuestionComment(
    questionId: string,
    commentId: string,
    actor: ModerationActor,
    dto: ProductQuestionModerationDto,
  ) {
    const question = await this.productQuestionModel.findById(questionId);
    if (!question) throw new NotFoundException('Product question not found');

    const comment = (question.comments ?? []).find(
      (item: any) => item._id.toString() === commentId,
    );
    if (!comment) throw new NotFoundException('Product question comment not found');

    const reason = this.moderationService.assertModerationReason(dto.reason);
    comment.moderationStatus = dto.action === 'delete' ? 'deleted' : 'hidden';
    comment.moderationReason = reason;
    comment.moderatedBy = this.getActorId(actor);
    comment.moderatedAt = new Date();

    await question.save();
    await this.moderationService.recordModerationAudit({
      actor,
      action: dto.action,
      targetType: 'product-question-comment',
      targetId: commentId,
      reason,
      metadata: { questionId, productId: question.productId?.toString() },
    });

    return this.toPublicQuestion(question);
  }
}
