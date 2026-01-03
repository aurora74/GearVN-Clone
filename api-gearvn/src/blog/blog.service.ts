import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Model, Query } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';

import { Blog, BlogDocument } from './blog.schema';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Injectable()
export class BlogService {
  constructor(
    @InjectModel(Blog.name) private blogModel: Model<BlogDocument>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async create(dto: CreateBlogDto, file: Express.Multer.File): Promise<Blog> {
    const uploaded = await this.cloudinaryService.uploadImage(file);
    if (!uploaded || !uploaded.secure_url) {
      throw new BadRequestException('Thumbnail upload failed');
    }

    const blog = new this.blogModel({
      ...dto,
      thumbnail: uploaded.secure_url,
    });

    return blog.save();
  }

  async findAll({
    page,
    limit,
    search,
    sortBy,
    fields,
  }: {
    page: number;
    limit: number;
    search?: string;
    sortBy?: string;
    fields?: string;
  }) {
    const filter: any = {};
    const skip = (page - 1) * limit;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
      ];
    }

    let mongooseQuery: Query<BlogDocument[], BlogDocument> =
      this.blogModel.find(filter);

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
    } else {
      mongooseQuery = mongooseQuery;
    }

    const [data, total] = await Promise.all([
      mongooseQuery.skip(skip).limit(limit).exec(),
      this.blogModel.countDocuments(filter),
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
    id: string,
    options: {
      page: number;
      limit: number;
      search?: string;
      sortBy?: string;
      fields?: string;
    },
  ) {
    const { page, limit, search, sortBy, fields } = options;

    const blog = await this.blogModel.findById(id);
    if (!blog) {
      throw new NotFoundException(`Blog with id "${id}" not found`);
    }

    const filter: any = { _id: { $ne: id } };

    if ((blog as any).category) {
      filter.category = (blog as any).category;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
      ];
    }

    let mongooseQuery: Query<BlogDocument[], BlogDocument> =
      this.blogModel.find(filter);

    if (sortBy) {
      const sortFields = sortBy
        .split(',')
        .map((field) =>
          field.startsWith('-') ? [field.slice(1), -1] : [field, 1],
        );
      mongooseQuery = mongooseQuery.sort(Object.fromEntries(sortFields));
    } else {
      mongooseQuery = mongooseQuery.sort({ createdAt: -1 });
    }

    if (fields) {
      mongooseQuery = mongooseQuery.select(fields.split(',').join(' '));
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      mongooseQuery.skip(skip).limit(limit).exec(),
      this.blogModel.countDocuments(filter),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }

  async findOne(id: string) {
    const blog = await this.blogModel.findById(id);
    if (!blog) throw new NotFoundException('Blog not found');

    return blog;
  }

  async findBySlug(slug: string): Promise<Blog> {
    const blog = await this.blogModel.findOne({ slug });
    if (!blog) {
      throw new BadRequestException(`Blog with slug "${slug}" not found`);
    }

    return blog;
  }

  async update(id: string, dto: UpdateBlogDto, file?: Express.Multer.File) {
    const blog = await this.blogModel.findById(id);
    if (!blog) throw new NotFoundException('Blog not found');

    Object.assign(blog, dto);

    if (file) {
      const uploaded = await this.cloudinaryService.uploadImage(file);
      blog.thumbnail = uploaded.secure_url;
    }

    return blog.save();
  }

  async remove(id: string) {
    const blog = await this.blogModel.findByIdAndDelete(id);
    if (!blog) throw new NotFoundException('Blog not found');

    return { message: 'Deleted successfully', id: blog._id };
  }
}
