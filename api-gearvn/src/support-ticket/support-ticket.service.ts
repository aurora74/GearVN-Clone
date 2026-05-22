import { randomBytes } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';

import { SUPPORT_TICKET_SOURCE, SUPPORT_TICKET_STATUS } from '../config.global';
import { Permission, roleHasPermission } from '../auth/policy/permissions';
import { OwnershipActor } from '../auth/policy/ownership';
import {
  SupportTicket,
  SupportTicketDocument,
  SupportTicketStatus,
} from './support-ticket.schema';

export interface CreateProductQuestionTicketInput {
  questionId: string;
  productId: string;
  productSlug?: string;
  customerId: string;
  contextLabel: string;
}

export interface CreateProductQuestionTicketOptions {
  session?: ClientSession;
}

export interface CreateChatTicketInput {
  roomId: string;
  customerId: string;
  latestMessageId: string;
  contextLabel: string;
  metadata?: Record<string, any>;
}

export interface ListSupportTicketsParams {
  status?: SupportTicketStatus;
  page?: number | string;
  limit?: number | string;
}

@Injectable()
export class SupportTicketService {
  constructor(
    @InjectModel(SupportTicket.name)
    private readonly supportTicketModel: Model<SupportTicketDocument>,
  ) {}

  private generateTicketCode() {
    return `TKT-${Date.now().toString(36).toUpperCase()}-${randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;
  }

  private getChatSourceId(input: CreateChatTicketInput) {
    const latestMessageId = input.latestMessageId?.trim();
    if (latestMessageId) return latestMessageId;

    return `${input.roomId}:${Date.now().toString(36)}:${randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;
  }

  private assertValidStatus(status: SupportTicketStatus) {
    if (!Object.values(SUPPORT_TICKET_STATUS).includes(status)) {
      throw new BadRequestException('Invalid support ticket status');
    }
  }

  private assertSupportActor(actor?: OwnershipActor | null) {
    if (!actor?.role || !roleHasPermission(actor.role, Permission.CSR_SUPPORT_MANAGE)) {
      throw new ForbiddenException('Support ticket update requires CSR support permission');
    }
  }

  private getStorableCustomerId(customerId?: string) {
    return customerId && Types.ObjectId.isValid(customerId) ? customerId : undefined;
  }

  private getCustomerMetadata(
    customerId?: string,
    metadata: Record<string, any> = {},
  ) {
    if (!customerId || Types.ObjectId.isValid(customerId)) return metadata;

    return {
      ...metadata,
      rawCustomerId: customerId,
    };
  }

  private customerLookupPipeline() {
    return [
      {
        $addFields: {
          customerIdObj: {
            $convert: {
              input: '$customerId',
              to: 'objectId',
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'customerIdObj',
          foreignField: '_id',
          as: 'customer',
        },
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          customerId: {
            $cond: [
              { $ifNull: ['$customer._id', false] },
              {
                _id: '$customer._id',
                fullName: '$customer.fullName',
                email: '$customer.email',
                avatarUrl: '$customer.avatarUrl',
              },
              { $ifNull: ['$customerId', '$metadata.rawCustomerId'] },
            ],
          },
        },
      },
      { $project: { customer: 0, customerIdObj: 0 } },
    ];
  }

  async createForProductQuestion(
    input: CreateProductQuestionTicketInput,
    options: CreateProductQuestionTicketOptions = {},
  ) {
    const existingQuery = this.supportTicketModel.findOne({
      sourceType: SUPPORT_TICKET_SOURCE.PRODUCT_QNA,
      sourceId: input.questionId,
    });
    if (options.session) {
      existingQuery.session(options.session);
    }

    const existing = await existingQuery;

    if (existing) {
      return existing;
    }

    const ticket = new this.supportTicketModel({
      ticketCode: this.generateTicketCode(),
      sourceType: SUPPORT_TICKET_SOURCE.PRODUCT_QNA,
      sourceId: input.questionId,
      customerId: this.getStorableCustomerId(input.customerId),
      contextLabel: input.contextLabel,
      status: SUPPORT_TICKET_STATUS.NEW,
      latestActivityAt: new Date(),
      resolvedAt: null,
      metadata: this.getCustomerMetadata(input.customerId, {
        productId: input.productId,
        productSlug: input.productSlug,
      }),
    });

    await ticket.save({ session: options.session });
    return ticket;
  }

  async createOrRefreshForChat(input: CreateChatTicketInput) {
    const chatSourceId = this.getChatSourceId(input);
    const existing = await this.supportTicketModel.findOne({
      sourceType: SUPPORT_TICKET_SOURCE.CHAT,
      roomId: input.roomId,
      status: { $ne: SUPPORT_TICKET_STATUS.RESOLVED },
    });

    if (existing) {
      existing.status = SUPPORT_TICKET_STATUS.NEW;
      existing.sourceId = existing.sourceId || chatSourceId;
      existing.customerId = this.getStorableCustomerId(input.customerId);
      existing.contextLabel = input.contextLabel;
      existing.latestActivityAt = new Date();
      existing.resolvedAt = null;
      existing.metadata = this.getCustomerMetadata(input.customerId, {
        ...(existing.metadata ?? {}),
        ...(input.metadata ?? {}),
        latestMessageId: input.latestMessageId,
      });
      await existing.save();
      return existing;
    }

    const ticket = new this.supportTicketModel({
      ticketCode: this.generateTicketCode(),
      sourceType: SUPPORT_TICKET_SOURCE.CHAT,
      sourceId: chatSourceId,
      roomId: input.roomId,
      customerId: this.getStorableCustomerId(input.customerId),
      contextLabel: input.contextLabel,
      status: SUPPORT_TICKET_STATUS.NEW,
      latestActivityAt: new Date(),
      resolvedAt: null,
      metadata: this.getCustomerMetadata(input.customerId, {
        ...(input.metadata ?? {}),
        latestMessageId: input.latestMessageId,
      }),
    });

    await ticket.save();
    return ticket;
  }

  async list({ status, page = 1, limit = 20 }: ListSupportTicketsParams = {}) {
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 20;
    const filter: Record<string, any> = {};

    if (status) {
      this.assertValidStatus(status);
      filter.status = status;
    }

    const [data, total] = await Promise.all([
      this.supportTicketModel.aggregate([
        { $match: filter },
        { $sort: { latestActivityAt: -1 } },
        { $skip: (pageNumber - 1) * limitNumber },
        { $limit: limitNumber },
        ...this.customerLookupPipeline(),
      ]),
      this.supportTicketModel.countDocuments(filter),
    ]);

    return {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
      data,
    };
  }

  async findOne(ticketId: string) {
    if (!Types.ObjectId.isValid(ticketId)) {
      throw new NotFoundException('Support ticket not found');
    }

    const [ticket] = await this.supportTicketModel.aggregate([
      { $match: { _id: new Types.ObjectId(ticketId) } },
      ...this.customerLookupPipeline(),
    ]);

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    if (ticket.status === SUPPORT_TICKET_STATUS.NEW) {
      const latestActivityAt = new Date();
      ticket.status = SUPPORT_TICKET_STATUS.PROCESSING;
      ticket.latestActivityAt = latestActivityAt;
      await this.supportTicketModel.updateOne(
        { _id: new Types.ObjectId(ticketId) },
        {
          $set: {
            status: SUPPORT_TICKET_STATUS.PROCESSING,
            latestActivityAt,
          },
        },
      );
    }

    return ticket;
  }

  async openTicket(ticketId: string) {
    return this.updateStatus(ticketId, SUPPORT_TICKET_STATUS.PROCESSING);
  }

  async markChatProcessing(roomId: string, actor?: OwnershipActor | null) {
    this.assertSupportActor(actor);
    const ticket = await this.supportTicketModel.findOne({
      sourceType: SUPPORT_TICKET_SOURCE.CHAT,
      roomId,
      status: { $ne: SUPPORT_TICKET_STATUS.RESOLVED },
    });

    if (!ticket) return null;

    if (ticket.status === SUPPORT_TICKET_STATUS.NEW) {
      ticket.status = SUPPORT_TICKET_STATUS.PROCESSING;
      ticket.latestActivityAt = new Date();
      await ticket.save();
    }

    return ticket;
  }

  async resolveChatTicket(roomId: string, actor?: OwnershipActor | null) {
    this.assertSupportActor(actor);
    const ticket = await this.supportTicketModel.findOne({
      sourceType: SUPPORT_TICKET_SOURCE.CHAT,
      roomId,
      status: { $ne: SUPPORT_TICKET_STATUS.RESOLVED },
    });

    if (!ticket) {
      throw new NotFoundException('Active chat support ticket not found');
    }

    ticket.status = SUPPORT_TICKET_STATUS.RESOLVED;
    ticket.latestActivityAt = new Date();
    ticket.resolvedAt = new Date();
    await ticket.save();
    return ticket;
  }

  async updateStatus(ticketId: string, status: SupportTicketStatus) {
    this.assertValidStatus(status);

    const ticket = await this.supportTicketModel.findById(ticketId);
    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    ticket.status = status;
    ticket.latestActivityAt = new Date();
    ticket.resolvedAt = status === SUPPORT_TICKET_STATUS.RESOLVED ? new Date() : null;

    await ticket.save();
    return ticket;
  }
}
