import { Model, Query } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, BadRequestException } from '@nestjs/common';

import { toCamelCase } from './helper/to-camel-case';
import { Event, EventDocument } from './event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Injectable()
export class EventService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async create(
    dto: CreateEventDto,
    files: { frame?: Express.Multer.File[]; image?: Express.Multer.File[] },
  ) {
    if (!files.frame?.[0]) {
      throw new BadRequestException('Please upload an event frame');
    }

    const uploadedFrame = await this.cloudinaryService.uploadImage(
      files.frame[0],
    );

    let uploadedImageUrl: string | undefined;
    if (files.image?.[0]) {
      const uploadedImage = await this.cloudinaryService.uploadImage(
        files.image[0],
      );
      uploadedImageUrl = uploadedImage.secure_url;
    }

    const newEvent = new this.eventModel({
      name: dto.name,
      frame: uploadedFrame.secure_url,
      image: uploadedImageUrl,
      tag: dto.tag
        .replace(/[-_ ]+(\w)/g, (_, c) => c.toUpperCase())
        .replace(/^./, (c) => c.toLowerCase()),
    });

    return newEvent.save();
  }

  async update(
    id: string,
    dto: Partial<CreateEventDto>,
    files?: { frame?: Express.Multer.File[]; image?: Express.Multer.File[] },
  ) {
    const event = await this.eventModel.findById(id);
    if (!event) {
      throw new BadRequestException('Event not found');
    }

    if (files?.frame?.[0]) {
      const uploadedFrame = await this.cloudinaryService.uploadImage(
        files.frame[0],
      );
      event.frame = uploadedFrame.secure_url;
    }

    if (files?.image?.[0]) {
      const uploadedImage = await this.cloudinaryService.uploadImage(
        files.image[0],
      );
      event.image = uploadedImage.secure_url;
    }

    event.name = dto.name ?? event.name;
    event.tag = dto.tag ? toCamelCase(dto.tag) : event.tag;

    return event.save();
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
        { name: { $regex: search, $options: 'i' } },
        { tag: { $regex: search, $options: 'i' } },
      ];
    }

    let mongooseQuery: Query<Event[], Event> = this.eventModel.find(filter);

    if (sortBy) {
      const sortFields = sortBy
        .split(',')
        .map((f) => (f.startsWith('-') ? [f.slice(1), -1] : [f, 1]));
      mongooseQuery = mongooseQuery.sort(Object.fromEntries(sortFields));
    } else {
      mongooseQuery = mongooseQuery.sort({ createdAt: -1 });
    }

    if (fields) {
      mongooseQuery = mongooseQuery.select(fields.split(',').join(' '));
    } else {
      mongooseQuery = mongooseQuery;
    }

    const [data, total] = await Promise.all([
      mongooseQuery.skip(skip).limit(limit).exec(),
      this.eventModel.countDocuments(filter),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }

  async remove(id: string) {
    const event = await this.eventModel.findById(id);
    if (!event) {
      throw new BadRequestException('Event not found');
    }

    await this.eventModel.deleteOne({ _id: id });

    return {
      message: 'Event deleted successfully',
    };
  }
}
