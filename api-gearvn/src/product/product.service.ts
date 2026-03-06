import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ClientSession, Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

import { CreateCommentDto } from './dto/create-comment.dto';
import { Product, ProductDocument } from './product.schema';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { validateImageUploads } from '../common/validators/upload-validator';
import { sanitizePlainTextContent } from '../common/validators/content-safety';
import {
  ModerationActor,
  ModerationService,
} from '../moderation/moderation.service';

const HIDDEN_CONTENT_PLACEHOLDER = 'Nội dung này đã được ẩn bởi Moderator.';

export interface ProductModerationDto {
  action: 'hide' | 'delete';
  reason: string;
}

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private cloudinaryService: CloudinaryService,
    private moderationService: ModerationService,
  ) {}

  private getActorId(actor: ModerationActor) {
    const actorId = actor?.id ?? actor?._id;
    if (!actorId) {
      throw new BadRequestException('Missing authenticated actor');
    }
    return String(actorId);
  }

  private recalculateRatingAggregates(product: ProductDocument | any) {
    const visibleReviews = (product.comments ?? []).filter(
      (comment) => (comment.moderationStatus ?? 'visible') === 'visible',
    );
    product.ratingsCount = visibleReviews.length;
    product.averageRating = visibleReviews.length
      ? visibleReviews.reduce((sum, comment) => sum + comment.rating, 0) /
        visibleReviews.length
      : 0;
  }

  private toPublicReplyItem(reply: any): any | null {
    const status = reply.moderationStatus ?? 'visible';
    if (status === 'deleted') return null;

    const publicReply = {
      ...reply,
      content: status === 'hidden' ? HIDDEN_CONTENT_PLACEHOLDER : reply.content,
      images: status === 'hidden' ? [] : (reply.images ?? []),
    };
    delete publicReply.moderationReason;
    delete publicReply.moderatedBy;
    delete publicReply.moderatedAt;
    return publicReply;
  }

  private toPublicCommentItem(comment: any): any | null {
    const status = comment.moderationStatus ?? 'visible';
    if (status === 'deleted') return null;

    const publicComment = {
      ...comment,
      content: status === 'hidden' ? HIDDEN_CONTENT_PLACEHOLDER : comment.content,
      images: status === 'hidden' ? [] : (comment.images ?? []),
      replies: (comment.replies ?? [])
        .map((reply) => this.toPublicReplyItem(reply))
        .filter(Boolean),
    };
    delete publicComment.moderationReason;
    delete publicComment.moderatedBy;
    delete publicComment.moderatedAt;
    return publicComment;
  }

  private toPublicComments(comments: any[] = []) {
    return comments
      .map((comment) => this.toPublicCommentItem(comment))
      .filter(Boolean);
  }

  async create(body: any, files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Please upload at least one image');
    }

    let parsedAttributes: Record<string, any>;
    try {
      parsedAttributes =
        typeof body.attributes === 'string'
          ? JSON.parse(body.attributes)
          : body.attributes;
    } catch {
      throw new BadRequestException('"attributes" field must be valid JSON');
    }

    const uploadedImages = await Promise.all(
      files.map((file) => this.cloudinaryService.uploadImage(file)),
    );

    const productData = {
      ...body,
      attributes: parsedAttributes,
      images: uploadedImages.map((img) => img.secure_url),
    };

    const product = new this.productModel(productData);
    return product.save();
  }

  async update(id: string, body: any, files: Express.Multer.File[]) {
    let parsedAttributes: Record<string, any>;
    try {
      parsedAttributes =
        typeof body.attributes === 'string'
          ? JSON.parse(body.attributes)
          : body.attributes;
    } catch {
      throw new BadRequestException('"attributes" field must be valid JSON');
    }

    let oldImages: string[] = [];
    try {
      oldImages =
        typeof body.oldImages === 'string'
          ? JSON.parse(body.oldImages)
          : body.oldImages || [];
    } catch {
      oldImages = [];
    }

    const newImages = files?.length
      ? await Promise.all(
          files.map((file) => this.cloudinaryService.uploadImage(file)),
        )
      : [];

    const updatedImages = [
      ...oldImages,
      ...newImages.map((img) => img.secure_url),
    ];

    const updateData = {
      ...body,
      attributes: parsedAttributes,
      images: updatedImages,
    };

    const updated = await this.productModel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      throw new BadRequestException(`Product with id "${id}" not found`);
    }

    return updated;
  }

  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    sortBy?: string;
    fields?: string;
    event?: string;
    category?: string;
    attributesRaw?: string;
  }) {
    const {
      page,
      limit,
      search,
      sortBy,
      fields,
      category,
      event,
      attributesRaw,
    } = params;
    const skip = (page - 1) * limit;

    const attributes: Record<string, string[]> = {};
    if (attributesRaw) {
      try {
        attributesRaw.split(';').forEach((entry) => {
          const [key, vals] = entry.split('=');
          if (key && vals) attributes[key] = vals.split(',');
        });
      } catch {
        throw new BadRequestException('Invalid attributes format');
      }
    }

    const filter: any = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) filter.category = category;
    if (event) filter.event = event;

    Object.entries(attributes).forEach(([key, values]) => {
      filter[`attributes.${key}`] = { $in: values };
    });

    let mongooseQuery = this.productModel.find(filter).lean<Product>();

    if (sortBy) {
      const sortFields = sortBy
        .split(',')
        .map((field) =>
          field.startsWith('-') ? [field.slice(1), -1] : [field, 1],
        );
      mongooseQuery = mongooseQuery.sort(Object.fromEntries(sortFields));
    }

    if (fields) {
      mongooseQuery = mongooseQuery.select(fields.split(',').join(' '));
    }

    const [data, total] = await Promise.all([
      mongooseQuery.skip(skip).limit(limit).exec(),
      this.productModel.countDocuments(filter),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }

  async findRelated(
    productId: string,
    options: {
      page: number;
      limit: number;
      search?: string;
      sortBy?: string;
      fields?: string;
    },
  ) {
    const { page, limit, search, sortBy, fields } = options;

    const original = await this.productModel.findById(productId);
    if (!original) return null;

    const query: any = {
      _id: { $ne: productId },
      category: original.category,
    };

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    query.price = {
      $gte: original.price * 0.8,
      $lte: original.price * 1.2,
    };

    const projection = fields
      ? fields.split(',').reduce((acc, f) => ({ ...acc, [f]: 1 }), {})
      : {};

    const total = await this.productModel.countDocuments(query);

    const data = await this.productModel
      .find(query, projection)
      .sort(sortBy ? { [sortBy]: 1 } : {})
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }

  async findBySlug(slug: string) {
    const product = await this.productModel
      .findOne({ slug })
      .populate({
        path: 'comments.userId',
        select: 'fullName email avatarUrl createdAt',
      })
      .populate({
        path: 'comments.replies.userId',
        select: 'fullName email avatarUrl createdAt',
      });

    if (!product) {
      throw new BadRequestException(`Product with slug "${slug}" not found`);
    }

    return product;
  }

  async findOne(id: string) {
    const product = await this.productModel
      .findById(id)
      .populate({
        path: 'comments.userId',
        select: 'fullName email avatarUrl createdAt',
      })
      .populate({
        path: 'comments.replies.userId',
        select: 'fullName email avatarUrl createdAt',
      });

    if (!product) {
      throw new BadRequestException(`Product with id "${id}" not found`);
    }

    return product;
  }

  async delete(id: string) {
    const product = await this.productModel.findById(id);
    if (!product) {
      throw new BadRequestException(`Product with id "${id}" not found`);
    }

    await this.productModel.findByIdAndDelete(id);

    return {
      message: 'Product deleted successfully',
    };
  }

  async comment(
    productId: string,
    userId: string,
    dto: CreateCommentDto,
    files: Express.Multer.File[],
  ) {
    const { rating } = dto;
    const content = sanitizePlainTextContent(dto.content, 'Comment content');

    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const product = await this.productModel.findById(productId);
    if (!product) throw new NotFoundException('Product not found');

    validateImageUploads(files);
    let uploadedImages: { secure_url: string }[] = [];
    if (files && files.length > 0) {
      uploadedImages = await Promise.all(
        files.map((file) => this.cloudinaryService.uploadImage(file)),
      );
    }

    product.comments.push({
      userId,
      content,
      images: uploadedImages.map((img) => img.secure_url),
      rating,
      createdAt: new Date(),
      moderationStatus: 'visible',
      likes: [],
      replies: [],
    });

    this.recalculateRatingAggregates(product);

    await product.save();

    return this.toPublicComments(product.comments);
  }

  async toggleLikeComment(
    productId: string,
    commentId: string,
    userId: string,
  ) {
    const product = await this.productModel.findById(productId);
    if (!product) throw new NotFoundException('Product not found');

    const comment = product.comments.find(
      (c: any) => c._id.toString() === commentId,
    );

    if (!comment) throw new NotFoundException('Comment not found');

    const index = comment.likes?.indexOf(userId) ?? -1;
    if (index >= 0) {
      comment.likes?.splice(index, 1);
    } else {
      comment.likes?.push(userId);
    }

    await product.save();

    return this.toPublicComments(product.comments);
  }

  async replyComment(
    productId: string,
    parentCommentId: string,
    userId: string,
    content: string,
    files: Express.Multer.File[],
  ) {
    const product = await this.productModel.findById(productId);
    if (!product) throw new NotFoundException('Product not found');

    const parentComment = product.comments.find(
      (c: any) => c._id.toString() === parentCommentId,
    );
    if (!parentComment) throw new NotFoundException('Parent comment not found');

    const normalizedContent = sanitizePlainTextContent(content, 'Reply content');
    validateImageUploads(files);
    let uploadedImages: string[] = [];
    if (files?.length) {
      const results = await Promise.all(
        files.map((file) => this.cloudinaryService.uploadImage(file)),
      );
      uploadedImages = results.map((img) => img.secure_url);
    }

    const reply: any = {
      _id: new Types.ObjectId().toString(),
      userId: userId,
      content: normalizedContent,
      images: uploadedImages,
      likes: [],
      createdAt: new Date(),
      moderationStatus: 'visible',
    };

    if (!parentComment.replies) {
      parentComment.replies = [];
    }
    parentComment.replies.push(reply);

    await product.save();
    return this.toPublicComments(product.comments);
  }

  async editComment(
    productId: string,
    commentId: string,
    userId: string,
    content: string,
    files: Express.Multer.File[],
    oldImages: string[] | string = [],
  ) {
    const product = await this.productModel.findById(productId);
    if (!product) throw new NotFoundException('Product not found');

    let parsedOldImages: string[] = [];
    if (typeof oldImages === 'string') {
      try {
        parsedOldImages = JSON.parse(oldImages);
      } catch (err) {
        throw new BadRequestException('oldImages is not a valid JSON array');
      }
    } else if (Array.isArray(oldImages)) {
      parsedOldImages = oldImages;
    }

    const normalizedContent = sanitizePlainTextContent(content, 'Comment content');
    validateImageUploads(files);
    let uploadedImages: string[] = [];
    if (files?.length) {
      const results = await Promise.all(
        files.map((file) => this.cloudinaryService.uploadImage(file)),
      );
      uploadedImages = results.map((img) => img.secure_url);
    }

    const updateCommentRecursively = (comments: any[]): any => {
      for (const c of comments) {
        if (c._id.toString() === commentId && c.userId.toString() === userId) {
          c.content = normalizedContent;
          c.images = [...parsedOldImages, ...uploadedImages];
          return c;
        }
        if (c.replies?.length) {
          const found = updateCommentRecursively(c.replies);
          if (found) return found;
        }
      }
      return null;
    };

    const updatedComment = updateCommentRecursively(product.comments);
    if (!updatedComment) throw new NotFoundException('Comment not found');

    await product.save();
    return updatedComment;
  }

  async deleteComment(productId: string, commentId: string, userId: string) {
    const product = await this.productModel.findById(productId);
    if (!product) throw new NotFoundException('Product not found');

    let found = false;
    const commentIndex = product.comments.findIndex(
      (c: any) =>
        c._id.toString() === commentId && c.userId.toString() === userId,
    );

    if (commentIndex !== -1) {
      product.comments.splice(commentIndex, 1);
      found = true;
    } else {
      for (const comment of product.comments) {
        const replyIndex = comment.replies.findIndex(
          (r: any) =>
            r._id.toString() === commentId && r.userId.toString() === userId,
        );
        if (replyIndex !== -1) {
          comment.replies.splice(replyIndex, 1);
          found = true;
          break;
        }
      }
    }

    if (!found) throw new NotFoundException('Comment not found');

    this.recalculateRatingAggregates(product);

    await product.save();

    return this.toPublicComments(product.comments);
  }

  async moderateComment(
    productId: string,
    commentId: string,
    actor: ModerationActor,
    dto: ProductModerationDto,
  ) {
    const product = await this.productModel.findById(productId);
    if (!product) throw new NotFoundException('Product not found');

    const comment = product.comments.find(
      (c: any) => c._id.toString() === commentId,
    );
    if (!comment) throw new NotFoundException('Comment not found');

    const reason = this.moderationService.assertModerationReason(dto.reason);
    comment.moderationStatus = dto.action === 'delete' ? 'deleted' : 'hidden';
    comment.moderationReason = reason;
    comment.moderatedBy = this.getActorId(actor);
    comment.moderatedAt = new Date();

    this.recalculateRatingAggregates(product);
    await product.save();
    await this.moderationService.recordModerationAudit({
      actor,
      action: dto.action,
      targetType: 'product-review',
      targetId: commentId,
      reason,
      metadata: { productId },
    });

    return this.toPublicComments(product.comments);
  }

  async moderateReply(
    productId: string,
    commentId: string,
    replyId: string,
    actor: ModerationActor,
    dto: ProductModerationDto,
  ) {
    const product = await this.productModel.findById(productId);
    if (!product) throw new NotFoundException('Product not found');

    const comment = product.comments.find(
      (c: any) => c._id.toString() === commentId,
    );
    if (!comment) throw new NotFoundException('Comment not found');

    const reply = (comment.replies ?? []).find(
      (item: any) => item._id.toString() === replyId,
    );
    if (!reply) throw new NotFoundException('Reply not found');

    const reason = this.moderationService.assertModerationReason(dto.reason);
    reply.moderationStatus = dto.action === 'delete' ? 'deleted' : 'hidden';
    reply.moderationReason = reason;
    reply.moderatedBy = this.getActorId(actor);
    reply.moderatedAt = new Date();

    await product.save();
    await this.moderationService.recordModerationAudit({
      actor,
      action: dto.action,
      targetType: 'product-review-reply',
      targetId: replyId,
      reason,
      metadata: { productId, commentId },
    });

    return this.toPublicComments(product.comments);
  }

  async getTopSellingProduct() {
    const product = await this.productModel
      .findOne({ soldQuantity: { $gt: 0 } })
      .sort({ soldQuantity: -1 })
      .select('name images soldQuantity')
      .lean();

    if (!product) return null;

    return product;
  }

  decreaseStock(
    productId: string,
    quantity: number,
    session?: ClientSession,
  ) {
    return this.productModel.findOneAndUpdate(
      {
        _id: productId,
        stock: { $gte: quantity },
      },
      { $inc: { stock: -quantity } },
      { new: true, session },
    );
  }

  increaseStock(productId: string, quantity: number, session?: ClientSession) {
    return this.productModel.updateOne(
      { _id: productId },
      { $inc: { stock: quantity } },
      { session },
    );
  }

  increaseSoldQuantity(
    productId: string,
    quantity: number,
    session?: ClientSession,
  ) {
    return this.productModel.updateOne(
      { _id: productId },
      { $inc: { soldQuantity: quantity } },
      { session },
    );
  }

  decreaseSoldQuantity(
    productId: string,
    quantity: number,
    session?: ClientSession,
  ) {
    return this.productModel.updateOne(
      {
        _id: productId,
        soldQuantity: { $gte: quantity },
      },
      { $inc: { soldQuantity: -quantity } },
      { session },
    );
  }
}
