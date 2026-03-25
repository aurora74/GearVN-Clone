import { Model, Query } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, BadRequestException } from '@nestjs/common';

import { toCamelCase } from './helper/to-camel-case';
import { Event, EventDocument } from './event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { AuditService } from '../audit/audit.service';
import { OwnershipActor } from '../auth/policy/ownership';
import { getFlashSaleStatus } from './helper/flash-sale-status';

export interface EventRequestContext {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class EventService {
  constructor(
    @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    dto: CreateEventDto,
    files: { frame?: Express.Multer.File[]; image?: Express.Multer.File[] },
    actor?: OwnershipActor,
    requestContext: EventRequestContext = {},
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
      tag: toCamelCase(dto.tag),
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      isEnabled: dto.isEnabled ?? true,
    });

    const savedEvent = await newEvent.save();
    await this.recordFlashSaleAudit({
      action: 'FLASH_SALE_CREATED',
      event: savedEvent,
      actor,
      requestContext,
      reason: dto.reason,
    });

    return this.serializeEvent(savedEvent);
  }

  async update(
    id: string,
    dto: Partial<CreateEventDto>,
    files?: { frame?: Express.Multer.File[]; image?: Express.Multer.File[] },
    actor?: OwnershipActor,
    requestContext: EventRequestContext = {},
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
    event.startsAt = dto.startsAt ? new Date(dto.startsAt) : event.startsAt;
    event.endsAt = dto.endsAt ? new Date(dto.endsAt) : event.endsAt;
    event.isEnabled = dto.isEnabled ?? event.isEnabled;

    const savedEvent = await event.save({ validateModifiedOnly: true });
    await this.recordFlashSaleAudit({
      action: 'FLASH_SALE_UPDATED',
      event: savedEvent,
      actor,
      requestContext,
      reason: dto.reason,
    });

    return this.serializeEvent(savedEvent);
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
      data: data.map((event) => this.serializeEvent(event)),
    };
  }

  serializeEvent(event: any, now = new Date()) {
    const serialized =
      typeof event?.toObject === 'function' ? event.toObject() : { ...event };

    return {
      ...serialized,
      status: getFlashSaleStatus(event, now),
    };
  }

  async findActiveFlashSaleByTag(tag: string, now = new Date()) {
    const event = await this.eventModel
      .findOne({
        tag: toCamelCase(tag),
        isEnabled: true,
        isArchived: { $ne: true },
        startsAt: { $lte: now },
        endsAt: { $gt: now },
      })
      .exec();

    return event ? this.serializeEvent(event, now) : null;
  }

  async setEnabled(
    id: string,
    isEnabled: boolean,
    actor?: OwnershipActor,
    requestContext: EventRequestContext = {},
    reason?: string,
    now = new Date(),
  ) {
    const event = await this.eventModel.findById(id);
    if (!event) {
      throw new BadRequestException('Event not found');
    }

    event.isEnabled = isEnabled;
    event.disabledAt = isEnabled ? undefined : now;

    const savedEvent = await event.save({ validateModifiedOnly: true });
    await this.recordFlashSaleAudit({
      action: isEnabled ? 'FLASH_SALE_ENABLED' : 'FLASH_SALE_DISABLED',
      event: savedEvent,
      actor,
      requestContext,
      reason,
    });

    return this.serializeEvent(savedEvent, now);
  }

  async endNow(
    id: string,
    actor?: OwnershipActor,
    requestContext: EventRequestContext = {},
    reason?: string,
    now = new Date(),
  ) {
    const event = await this.eventModel.findById(id);
    if (!event) {
      throw new BadRequestException('Event not found');
    }

    event.endsAt = now;

    const savedEvent = await event.save({ validateModifiedOnly: true });
    await this.recordFlashSaleAudit({
      action: 'FLASH_SALE_ENDED',
      event: savedEvent,
      actor,
      requestContext,
      reason,
    });

    return this.serializeEvent(savedEvent, now);
  }

  async archive(
    id: string,
    actor?: OwnershipActor,
    requestContext: EventRequestContext = {},
    reason?: string,
    now = new Date(),
  ) {
    const event = await this.eventModel.findById(id);
    if (!event) {
      throw new BadRequestException('Event not found');
    }

    event.isArchived = true;
    event.archivedAt = now;
    event.isEnabled = false;
    event.disabledAt = event.disabledAt ?? now;

    const savedEvent = await event.save({ validateModifiedOnly: true });
    await this.recordFlashSaleAudit({
      action: 'FLASH_SALE_ARCHIVED',
      event: savedEvent,
      actor,
      requestContext,
      reason,
    });

    return this.serializeEvent(savedEvent, now);
  }

  async remove(
    id: string,
    actor?: OwnershipActor,
    requestContext: EventRequestContext = {},
    reason?: string,
  ) {
    await this.archive(id, actor, requestContext, reason);

    return {
      message: 'Event archived successfully',
    };
  }

  private async recordFlashSaleAudit({
    action,
    event,
    actor,
    requestContext,
    reason,
  }: {
    action: string;
    event: any;
    actor?: OwnershipActor;
    requestContext: EventRequestContext;
    reason?: string;
  }) {
    await this.auditService.record({
      actorId: String(actor?.id ?? actor?._id ?? ''),
      actorRole: actor?.role,
      action,
      targetType: 'flash-sale',
      targetId: String(event?._id ?? ''),
      reason: reason?.trim() || undefined,
      metadata: {
        tag: event?.tag,
        startsAt: event?.startsAt,
        endsAt: event?.endsAt,
        isEnabled: event?.isEnabled,
        disabledAt: event?.disabledAt,
      },
      ip: requestContext.ip,
      userAgent: requestContext.userAgent,
    });
  }
}
