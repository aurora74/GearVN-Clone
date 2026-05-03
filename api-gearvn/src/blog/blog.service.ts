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
import { CloudinaryService } from '../cloudinary/cloudinary.service';

type CleanupWarning = { cleanupWarning?: true; cleanupFailedAssets?: string[] };
type BlogSortDirection = 1 | -1;

const ALLOWED_BLOG_SORT_FIELDS = new Set(['createdAt', 'publishedAt', 'title']);
const DEFAULT_BLOG_SORT: Record<string, BlogSortDirection> = {
  createdAt: -1,
  _id: -1,
};

const parseBlogSort = (sortBy?: string): Record<string, BlogSortDirection> => {
  const sort = (sortBy ?? '')
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean)
    .reduce<Record<string, BlogSortDirection>>((acc, field) => {
      const direction: BlogSortDirection = field.startsWith('-') ? -1 : 1;
      const fieldName = field.startsWith('-') ? field.slice(1) : field;

      if (ALLOWED_BLOG_SORT_FIELDS.has(fieldName)) {
        acc[fieldName] = direction;
      }

      return acc;
    }, {});

  return Object.keys(sort).length > 0 ? sort : DEFAULT_BLOG_SORT;
};

@Injectable()
export class BlogService {
  constructor(
    @InjectModel(Blog.name) private blogModel: Model<BlogDocument>,
    private cloudinaryService: CloudinaryService,
  ) {}

  private async cleanupReplacedThumbnail(
    url?: string,
  ): Promise<CleanupWarning> {
    if (!url) return {};

    try {
      await this.cloudinaryService.deleteImage(url);
      return {};
    } catch (error) {
      console.warn('Failed to delete replaced blog thumbnail', { url, error });
      return { cleanupWarning: true, cleanupFailedAssets: [url] };
    }
  }

  private withCleanupWarning<T>(
    record: T,
    cleanup: CleanupWarning,
  ): T & CleanupWarning {
    if (!cleanup.cleanupWarning) return record as T & CleanupWarning;
    const base =
      record && typeof (record as any).toObject === 'function'
        ? (record as any).toObject()
        : record;
    return { ...(base as any), ...cleanup };
  }

  async create(dto: CreateBlogDto, file: Express.Multer.File): Promise<Blog> {
    const uploaded = await this.cloudinaryService.uploadImage(file);
    if (!uploaded || !uploaded.secure_url) {
      throw new BadRequestException('Thumbnail upload failed');
    }

    const blog = new this.blogModel({
      ...dto,
      thumbnail: uploaded.secure_url,
      isPublished: false,
      publishedAt: undefined,
      unpublishedAt: undefined,
    });

    try {
      return await blog.save();
    } catch (error) {
      await this.cleanupReplacedThumbnail(uploaded.secure_url);
      throw error;
    }
  }

  async findAll({
    page,
    limit,
    search,
    sortBy,
    fields,
    publicOnly = true,
    visibility = 'active',
  }: {
    page: number;
    limit: number;
    search?: string;
    sortBy?: string;
    fields?: string;
    publicOnly?: boolean;
    visibility?: 'all' | 'active' | 'unpublished' | 'archived';
  }) {
    const filter: any = {};
    const skip = (page - 1) * limit;

    if (publicOnly) {
      filter.$or = [{ isPublished: true }, { isPublished: { $exists: false } }];
      filter.isArchived = { $ne: true };
    } else if (visibility === 'all') {
      filter.isArchived = { $ne: true };
    } else if (visibility === 'active') {
      filter.$or = [{ isPublished: true }, { isPublished: { $exists: false } }];
      filter.isArchived = { $ne: true };
    } else if (visibility === 'unpublished') {
      filter.isPublished = false;
      filter.isArchived = { $ne: true };
    } else if (visibility === 'archived') {
      filter.isArchived = true;
    }

    if (search) {
      const searchFilter = [
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchFilter }];
        delete filter.$or;
      } else {
        filter.$or = searchFilter;
      }
    }

    let mongooseQuery: Query<BlogDocument[], BlogDocument> =
      this.blogModel.find(filter);

    mongooseQuery = mongooseQuery.sort(parseBlogSort(sortBy));

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

    const filter: any = {
      _id: { $ne: id },
      $or: [{ isPublished: true }, { isPublished: { $exists: false } }],
      isArchived: { $ne: true },
    };

    if ((blog as any).category) {
      filter.category = (blog as any).category;
    }

    if (search) {
      const visibilityFilter = filter.$or;
      const searchFilter = [
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
      ];
      filter.$and = [{ $or: visibilityFilter }, { $or: searchFilter }];
      delete filter.$or;
    }

    let mongooseQuery: Query<BlogDocument[], BlogDocument> =
      this.blogModel.find(filter);

    mongooseQuery = mongooseQuery.sort(parseBlogSort(sortBy));

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

  async findBySlug(
    slug: string,
    options: { publicOnly?: boolean } = {},
  ): Promise<Blog> {
    const blog = await this.blogModel.findOne({
      slug,
      isArchived: { $ne: true },
    });
    if (!blog) {
      throw new BadRequestException(`Blog with slug "${slug}" not found`);
    }

    if (
      options.publicOnly !== false &&
      (blog.isPublished === false || blog.isArchived === true)
    ) {
      throw new BadRequestException(`Blog with slug "${slug}" not found`);
    }

    return blog;
  }

  async setPublished(id: string, isPublished: boolean) {
    const blog = await this.blogModel.findById(id);
    if (!blog) throw new NotFoundException('Blog not found');

    blog.isPublished = isPublished;
    if (isPublished) {
      blog.publishedAt = blog.publishedAt ?? new Date();
      blog.unpublishedAt = undefined;
    } else {
      blog.unpublishedAt = new Date();
    }

    await blog.save();
    return blog;
  }

  async update(id: string, dto: UpdateBlogDto, file?: Express.Multer.File) {
    const blog = await this.blogModel.findById(id);
    if (!blog) throw new NotFoundException('Blog not found');

    const previousThumbnail = blog.thumbnail;
    Object.assign(blog, dto);

    if (file) {
      const uploaded = await this.cloudinaryService.uploadImage(file);
      blog.thumbnail = uploaded.secure_url;
    }

    const saved = await blog.save();
    const cleanup =
      file && previousThumbnail !== blog.thumbnail
        ? await this.cleanupReplacedThumbnail(previousThumbnail)
        : {};

    return this.withCleanupWarning(saved, cleanup);
  }

  async archive(id: string) {
    const blog = await this.blogModel.findById(id);
    if (!blog) throw new NotFoundException('Blog not found');

    blog.isArchived = true;
    blog.archivedAt = new Date();
    blog.isPublished = false;
    blog.unpublishedAt = blog.unpublishedAt ?? new Date();

    return blog.save();
  }

  async remove(id: string) {
    const blog = await this.archive(id);

    return { message: 'Archived successfully', id: blog._id };
  }
}
