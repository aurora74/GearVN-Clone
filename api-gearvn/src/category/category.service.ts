import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Model, Query } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

import { Category } from './category.schema';
import { toCamelCase } from './helper/to-camel-case';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Product, ProductDocument } from '../product/product.schema';

type CleanupWarning = { cleanupWarning?: true; cleanupFailedAssets?: string[] };
type CategorySortDirection = 1 | -1;

const ALLOWED_CATEGORY_SORT_FIELDS = new Set(['createdAt', 'label', 'name']);
const DEFAULT_CATEGORY_SORT: Record<string, CategorySortDirection> = {
  createdAt: -1,
  _id: -1,
};

const parseCategorySort = (
  sortBy?: string,
): Record<string, CategorySortDirection> => {
  const sort = (sortBy ?? '')
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean)
    .reduce<Record<string, CategorySortDirection>>((acc, field) => {
      const direction: CategorySortDirection = field.startsWith('-') ? -1 : 1;
      const fieldName = field.startsWith('-') ? field.slice(1) : field;

      if (ALLOWED_CATEGORY_SORT_FIELDS.has(fieldName)) {
        acc[fieldName] = direction;
      }

      return acc;
    }, {});

  return Object.keys(sort).length > 0 ? sort : DEFAULT_CATEGORY_SORT;
};

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<Category>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private cloudinaryService: CloudinaryService,
  ) {}

  private async hasActiveProductsForCategory(categoryName: string) {
    return Boolean(
      await this.productModel.exists({
        category: categoryName,
        isArchived: { $ne: true },
      }),
    );
  }

  private async assertNoActiveProductsForCategory(categoryName: string) {
    if (await this.hasActiveProductsForCategory(categoryName)) {
      throw new BadRequestException('CATEGORY_HAS_DEPENDENT_PRODUCTS');
    }
  }

  private async assertSafeFieldChanges(
    categoryName: string,
    currentFields: any[] = [],
    nextFields: any[] = [],
  ) {
    const currentByName = new Map(
      currentFields.map((field) => [toCamelCase(field.name), field]),
    );
    const nextByName = new Map(
      nextFields.map((field) => [toCamelCase(field.name), field]),
    );

    for (const [fieldName, currentField] of currentByName) {
      const nextField = nextByName.get(fieldName);
      const removed = !nextField;
      const typeChanged = nextField && nextField.type !== currentField.type;

      if (!removed && !typeChanged) continue;

      const productHasAttribute = await this.productModel.exists({
        category: categoryName,
        isArchived: { $ne: true },
        [`attributes.${fieldName}`]: { $exists: true },
      });

      if (productHasAttribute) {
        throw new BadRequestException('CATEGORY_FIELD_HAS_DEPENDENT_PRODUCTS');
      }
    }
  }

  private async cleanupReplacedImage(url?: string): Promise<CleanupWarning> {
    if (!url) return {};

    try {
      await this.cloudinaryService.deleteImage(url);
      return {};
    } catch (error) {
      console.warn('Failed to delete replaced category image', { url, error });
      return { cleanupWarning: true, cleanupFailedAssets: [url] };
    }
  }

  private withCleanupWarning<T>(record: T, cleanup: CleanupWarning): T & CleanupWarning {
    if (!cleanup.cleanupWarning) return record as T & CleanupWarning;
    const base =
      record && typeof (record as any).toObject === 'function'
        ? (record as any).toObject()
        : record;
    return { ...(base as any), ...cleanup };
  }

  async create(dto: CreateCategoryDto, file?: Express.Multer.File) {
    let fields: any[] = [];

    if (typeof dto.fields === 'string') {
      try {
        fields = JSON.parse(dto.fields);
      } catch (e) {
        throw new BadRequestException('Invalid fields format');
      }
    } else {
      fields = dto.fields;
    }

    if (!Array.isArray(fields)) {
      throw new BadRequestException('Invalid fields format');
    }
    const normalizedFields = fields.map((field) => {
      let options = field.options;

      if (field.type === 'number' && options) {
        options = options.map((opt) => Number(opt));
      }

      return {
        ...field,
        name: toCamelCase(field.name),
        options,
      };
    });

    let imageUrl: string | undefined;
    if (file) {
      const uploaded = await this.cloudinaryService.uploadImage(file);
      imageUrl = uploaded.secure_url;
    }

    const normalizedDto = {
      ...dto,
      name: toCamelCase(dto.name),
      fields: normalizedFields,
      image: imageUrl,
    };

    try {
      return await this.categoryModel.create(normalizedDto);
    } catch (error) {
      if (imageUrl) {
        await this.cleanupReplacedImage(imageUrl);
      }
      throw error;
    }
  }

  async findAll(query: {
    page: number;
    limit: number;
    search?: string;
    sortBy?: string;
    fields?: string;
    publicOnly?: boolean;
    visibility?: 'all' | 'active' | 'unpublished' | 'archived';
  }) {
    const { page, limit, search, sortBy, fields, publicOnly = true, visibility = 'active' } = query;
    const skip = (page - 1) * limit;

    const filter: any = publicOnly
      ? { isPublished: { $ne: false }, isArchived: { $ne: true } }
      : {};

    if (!publicOnly) {
      if (visibility === 'active') {
        filter.isPublished = { $ne: false };
        filter.isArchived = { $ne: true };
      } else if (visibility === 'unpublished') {
        filter.isPublished = false;
        filter.isArchived = { $ne: true };
      } else if (visibility === 'archived') {
        filter.isArchived = true;
      }
    }
    if (search) {
      filter.$or = [{ label: { $regex: search, $options: 'i' } }];
    }

    let mongooseQuery: Query<Category[], Category> =
      this.categoryModel.find(filter);

    mongooseQuery = mongooseQuery.sort(parseCategorySort(sortBy));

    if (fields) {
      mongooseQuery = mongooseQuery.select(fields.split(',').join(' '));
    } else {
      mongooseQuery = mongooseQuery;
    }

    const [data, total] = await Promise.all([
      mongooseQuery.skip(skip).limit(limit).exec(),
      this.categoryModel.countDocuments(filter),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }

  async findCategoryByName(name: string) {
    const category = await this.categoryModel
      .findOne({
        name,
        isPublished: { $ne: false },
        isArchived: { $ne: true },
      })
      .select('fields');
    if (!category) {
      throw new NotFoundException(`Category ${name} not found`);
    }

    return category.fields;
  }

  async findLabelByCategory(category: string) {
    const cat = await this.categoryModel.findOne({
      name: category,
      isPublished: { $ne: false },
      isArchived: { $ne: true },
    });
    if (!cat) {
      throw new NotFoundException(`Category "${category}" not found`);
    }
    return { label: cat.label };
  }

  async update(id: string, dto: UpdateCategoryDto, file?: Express.Multer.File) {
    let fields: any[] | undefined;
    if (dto.fields) {
      if (typeof dto.fields === 'string') {
        try {
          fields = JSON.parse(dto.fields);
        } catch {
          throw new BadRequestException('Invalid fields format');
        }
      } else {
        fields = dto.fields;
      }
    }

    if (fields !== undefined && !Array.isArray(fields)) {
      throw new BadRequestException('Invalid fields format');
    }

    const normalizedFields = fields?.map((field) => {
      let options = field.options;
      if (field.type === 'number' && options) {
        options = options.map((opt) => Number(opt));
      }
      return {
        ...field,
        name: toCamelCase(field.name),
        options,
      };
    });

    const currentCategory = await this.categoryModel.findById(id);
    if (!currentCategory) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    const nextName = dto.name ? toCamelCase(dto.name) : undefined;
    if (nextName && nextName !== currentCategory.name) {
      await this.assertNoActiveProductsForCategory(currentCategory.name);
    }

    if (normalizedFields) {
      await this.assertSafeFieldChanges(
        currentCategory.name,
        currentCategory.fields,
        normalizedFields,
      );
    }

    let imageUrl: string | undefined;
    if (file) {
      const uploaded = await this.cloudinaryService.uploadImage(file);
      imageUrl = uploaded.secure_url;
    }

    const normalizedDto: any = {
      ...dto,
      name: nextName,
      fields: normalizedFields ?? dto.fields,
      ...(imageUrl ? { image: imageUrl } : {}),
    };

    let updated: Category | null;
    try {
      updated = await this.categoryModel.findByIdAndUpdate(
        id,
        normalizedDto,
        {
          new: true,
        },
      );
    } catch (error) {
      if (imageUrl) {
        await this.cleanupReplacedImage(imageUrl);
      }
      throw error;
    }

    if (!updated) {
      if (imageUrl) {
        await this.cleanupReplacedImage(imageUrl);
      }
      throw new NotFoundException(`Category ${id} not found`);
    }

    const cleanup = imageUrl && currentCategory.image !== imageUrl
      ? await this.cleanupReplacedImage(currentCategory.image)
      : {};

    return this.withCleanupWarning(updated, cleanup);
  }

  async setPublished(id: string, isPublished: boolean) {
    const category = await this.categoryModel.findById(id);
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    category.isPublished = isPublished;
    if (isPublished) {
      category.publishedAt = category.publishedAt ?? new Date();
      category.unpublishedAt = undefined;
    } else {
      category.unpublishedAt = new Date();
    }

    return category.save();
  }

  async archive(id: string) {
    const category = await this.categoryModel.findById(id);
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    await this.assertNoActiveProductsForCategory(category.name);

    category.isArchived = true;
    category.archivedAt = new Date();
    category.isPublished = false;
    category.unpublishedAt = category.unpublishedAt ?? new Date();

    return category.save();
  }

  async remove(id: string) {
    return this.archive(id);
  }
}
