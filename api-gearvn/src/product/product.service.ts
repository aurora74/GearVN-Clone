import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

import { CreateCommentDto } from './dto/create-comment.dto';
import { Product, ProductDocument } from './product.schema';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private cloudinaryService: CloudinaryService,
  ) {}

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
    const { content, rating } = dto;

    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const product = await this.productModel.findById(productId);
    if (!product) throw new NotFoundException('Product not found');

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
      likes: [],
      replies: [],
    });

    const totalRatings = product.comments.length;
    const avgRating =
      product.comments.reduce((sum, c) => sum + c.rating, 0) / totalRatings;

    product.averageRating = avgRating;
    product.ratingsCount = totalRatings;

    await product.save();

    return product.comments;
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

    return product.comments;
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

    let uploadedImages: string[] = [];
    if (files?.length) {
      const results = await Promise.all(
        files.map((file) => this.cloudinaryService.uploadImage(file)),
      );
      uploadedImages = results.map((img) => img.secure_url);
    }

    const reply = {
      _id: new Types.ObjectId().toString(),
      userId: userId,
      content,
      images: uploadedImages,
      likes: [],
      createdAt: new Date(),
    };

    if (!parentComment.replies) {
      parentComment.replies = [];
    }
    parentComment.replies.push(reply);

    await product.save();
    return product.comments;
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
          c.content = content;
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

    const totalRatings = product.comments.length;
    const avgRating =
      totalRatings === 0
        ? 0
        : product.comments.reduce((sum, c) => sum + c.rating, 0) / totalRatings;

    product.averageRating = avgRating;
    product.ratingsCount = totalRatings;

    await product.save();

    return product.comments;
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

  decreaseStock(productId: string, quantity: number) {
    return this.productModel.findByIdAndUpdate(
      productId,
      { $inc: { stock: -quantity } },
      { new: true },
    );
  }

  increaseSoldQuantity(productId: string, quantity: number) {
    return this.productModel.updateOne(
      { _id: productId },
      { $inc: { soldQuantity: quantity } },
    );
  }
}
