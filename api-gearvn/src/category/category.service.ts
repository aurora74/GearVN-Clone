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
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<Category>,
    private cloudinaryService: CloudinaryService,
  ) {}

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

    return this.categoryModel.create(normalizedDto);
  }

  async findAll(query: {
    page: number;
    limit: number;
    search?: string;
    sortBy?: string;
    fields?: string;
  }) {
    const { page, limit, search, sortBy, fields } = query;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (search) {
      filter.$or = [{ label: { $regex: search, $options: 'i' } }];
    }

    let mongooseQuery: Query<Category[], Category> =
      this.categoryModel.find(filter);

    if (sortBy) {
      const sortFields = sortBy
        .split(',')
        .map((f) => (f.startsWith('-') ? [f.slice(1), -1] : [f, 1]));
      mongooseQuery = mongooseQuery.sort(Object.fromEntries(sortFields));
    }

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
      .findOne({ name })
      .select('fields');
    if (!category) {
      throw new NotFoundException(`Category ${name} not found`);
    }

    return category.fields;
  }

  async findLabelByCategory(category: string) {
    const cat = await this.categoryModel.findOne({ name: category });
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

    let imageUrl: string | undefined;
    if (file) {
      const uploaded = await this.cloudinaryService.uploadImage(file);
      imageUrl = uploaded.secure_url;
    }

    const normalizedDto: any = {
      ...dto,
      name: dto.name ? toCamelCase(dto.name) : undefined,
      fields: normalizedFields ?? dto.fields,
      ...(imageUrl ? { image: imageUrl } : {}),
    };

    const updated = await this.categoryModel.findByIdAndUpdate(
      id,
      normalizedDto,
      {
        new: true,
      },
    );

    if (!updated) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    return updated;
  }

  async remove(id: string) {
    const deleted = await this.categoryModel.findByIdAndDelete(id);
    if (!deleted) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    return deleted;
  }
}
