import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { Chat, ChatDocument } from './chat.schema';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Permission, roleHasPermission } from '../auth/policy/permissions';
import {
  assertOwnerOrPermission,
  OwnershipActor,
} from '../auth/policy/ownership';
import { UserRole } from '../auth/enums/user-role.enum';
import { validateImageUploads } from '../common/validators/upload-validator';
import { SupportTicketService } from '../support-ticket/support-ticket.service';

type ChatMessageKind = 'user' | 'assistant' | 'system';

type InternalChatMessageInput = Partial<Chat> & {
  roomId: string;
  userId: string;
  text?: string;
  sender: 'CUSTOMER' | 'ADMIN';
  messageKind: Exclude<ChatMessageKind, 'user'>;
  metadata?: Record<string, any>;
};

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    private cloudinaryService: CloudinaryService,
    private supportTicketService: SupportTicketService,
  ) {}

  private getActorId(actor?: OwnershipActor | null) {
    return actor?.id ?? actor?._id?.toString();
  }

  private getRoomOwnerId(roomId?: string): string | null {
    const prefix = 'room-client-';

    if (!roomId?.startsWith(prefix)) {
      return null;
    }

    return roomId.slice(prefix.length) || null;
  }

  isSupportActor(actor?: OwnershipActor | null): boolean {
    return !!actor?.role && roleHasPermission(actor.role, Permission.CSR_SUPPORT_MANAGE);
  }

  assertCanAccessChatRoom(actor: OwnershipActor | null | undefined, roomId?: string) {
    this.assertCanAccessChatResource({ actor, roomId });
    const ownerId = this.getRoomOwnerId(roomId);
    if (!ownerId) {
      throw new BadRequestException('Invalid chat room');
    }
    return ownerId;
  }

  private assertCanAccessChatResource({
    actor,
    roomId,
    userId,
    targetType = 'chat',
  }: {
    actor?: OwnershipActor | null;
    roomId?: string;
    userId?: string;
    targetType?: string;
  }): void {
    const roomOwnerId = this.getRoomOwnerId(roomId);

    if (roomOwnerId && userId && String(roomOwnerId) !== String(userId)) {
      throw new BadRequestException('Chat room and user do not match');
    }

    assertOwnerOrPermission({
      actor,
      ownerId: userId ?? roomOwnerId,
      permission: Permission.CSR_SUPPORT_MANAGE,
      targetType,
    });
  }

  async create(message: Partial<Chat>, actor?: OwnershipActor | null) {
    const roomOwnerId = this.assertCanAccessChatRoom(actor, message.roomId);
    const supportActor = this.isSupportActor(actor);
    const sender = supportActor ? UserRole.ADMIN : UserRole.CUSTOMER;
    const userId = supportActor ? roomOwnerId : this.getActorId(actor) ?? roomOwnerId;
    const text = typeof message.text === 'string' ? message.text.trim() : '';
    const attachments = this.normalizeAttachments(message.attachments);

    if (String(userId) !== String(roomOwnerId)) {
      throw new BadRequestException('Chat room and user do not match');
    }

    this.assertMessageHasContent(text, attachments);

    const chat = new this.chatModel({
      text,
      attachments,
      sender,
      userId: roomOwnerId,
      roomId: message.roomId,
      isRead: message.isRead,
      unreadCount: message.unreadCount,
      messageKind: 'user',
    });
    const saved = (await chat.save()) ?? chat;

    if (sender === UserRole.CUSTOMER && !saved.isRead) {
      await this.supportTicketService.createOrRefreshForChat({
        roomId: message.roomId!,
        customerId: roomOwnerId,
        latestMessageId: saved._id.toString(),
        contextLabel: 'Chat khách hàng',
      });
    }

    return saved;
  }

  async createInternalMessage(message: InternalChatMessageInput) {
    const roomOwnerId = this.assertCanAccessChatRoom(
      { id: message.userId, role: UserRole.CUSTOMER },
      message.roomId,
    );
    const text = typeof message.text === 'string' ? message.text.trim() : '';
    const attachments = this.normalizeAttachments(message.attachments);

    this.assertMessageHasContent(text, attachments);

    const chat = new this.chatModel({
      text,
      attachments,
      sender: message.sender,
      userId: roomOwnerId,
      roomId: message.roomId,
      isRead: message.isRead,
      unreadCount: message.unreadCount ?? 0,
      messageKind: message.messageKind,
      metadata: message.metadata,
    });

    return (await chat.save()) ?? chat;
  }

  serializeCustomerMessage<T extends { metadata?: Record<string, any> }>(message: T): T {
    const base = typeof (message as any)?.toObject === 'function'
      ? (message as any).toObject()
      : { ...(message as any) };
    const metadata = this.filterCustomerMetadata(base.metadata);

    return {
      ...base,
      metadata,
    };
  }

  private normalizeAttachments(attachments?: string[]) {
    return Array.isArray(attachments)
      ? attachments
          .filter((attachment): attachment is string => typeof attachment === 'string')
          .map((attachment) => attachment.trim())
          .filter(Boolean)
      : [];
  }

  private assertMessageHasContent(text: string, attachments: string[]) {
    if (!text && attachments.length === 0) {
      throw new BadRequestException('Message text or attachment is required');
    }
  }

  private filterCustomerMetadata(metadata?: Record<string, any>) {
    if (!metadata || typeof metadata !== 'object') return metadata;
    return stripStaffOnlyMetadata(metadata);
  }

  async uploadFiles(files: Express.Multer.File[]): Promise<string[]> {
    if (!files || files.length === 0) return [];

    validateImageUploads(files, {
      maxFiles: 10,
      maxFileSizeBytes: 5 * 1024 * 1024,
    });

    const uploadResults = await Promise.all(
      files.map((file) => this.cloudinaryService.uploadImage(file)),
    );

    return uploadResults.map((res) => res.secure_url);
  }

  async findAll({
    page = 1,
    limit = 10,
    search,
    sortBy,
    roomId,
    userId,
    actor,
  }: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    roomId?: string;
    userId?: string;
    actor?: OwnershipActor | null;
  }) {
    this.assertCanAccessChatResource({ actor, roomId, userId });

    const query: any = {};
    if (search) query.text = { $regex: search, $options: 'i' };
    if (roomId) query.roomId = roomId;
    if (userId) query.userId = userId;

    let mongoQuery = this.chatModel.find(query).populate({
      path: 'userId',
      select: 'fullName email avatarUrl',
    });

    if (sortBy) {
      const sort: any = {};
      sortBy.split(',').forEach((field) => {
        if (field.startsWith('-')) {
          sort[field.substring(1)] = -1;
        } else {
          sort[field] = 1;
        }
      });
      mongoQuery = mongoQuery.sort(sort);
    }

    const total = await this.chatModel.countDocuments(query);
    const data = await mongoQuery
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: this.isSupportActor(actor)
        ? data
        : data.map((message) => this.serializeCustomerMessage(message as any)),
    };
  }

  async findLatestPerUser({
    page = 1,
    limit = 10,
    search,
    sortBy,
    roomId,
    userId,
    actor,
  }: {
    page?: number | string;
    limit?: number | string;
    search?: string;
    sortBy?: string;
    roomId?: string;
    userId?: string;
    actor?: OwnershipActor | null;
  }) {
    this.assertCanAccessChatResource({ actor, roomId, userId });

    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;

    const match: any = {};
    if (roomId) match.roomId = roomId;
    if (userId) match.userId = userId;

    const pipeline: any[] = [
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$userId',
          latestMessage: { $first: '$$ROOT' },
        },
      },
      { $replaceRoot: { newRoot: '$latestMessage' } },
      { $addFields: { userIdObj: { $toObjectId: '$userId' } } },
      {
        $lookup: {
          from: 'users',
          localField: 'userIdObj',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          userId: {
            _id: { $ifNull: ['$user._id', '$userIdObj'] },
            fullName: { $ifNull: ['$user.fullName', 'Deleted user'] },
            avatarUrl: '$user.avatarUrl',
          },
        },
      },
      { $project: { user: 0, userIdObj: 0 } },
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { text: { $regex: search, $options: 'i' } },
            { 'userId.fullName': { $regex: search, $options: 'i' } },
          ],
        },
      });
    }

    if (sortBy) {
      const sort: any = {};
      sortBy.split(',').forEach((field) => {
        if (field.startsWith('-')) sort[field.substring(1)] = -1;
        else sort[field] = 1;
      });
      pipeline.push({ $sort: sort });
    } else {
      pipeline.push({ $sort: { createdAt: -1 } });
    }

    const totalAgg = await this.chatModel.aggregate([
      ...pipeline,
      { $count: 'total' },
    ]);
    const total = totalAgg[0]?.total || 0;

    const data = await this.chatModel.aggregate([
      ...pipeline,
      { $skip: (pageNumber - 1) * limitNumber },
      { $limit: limitNumber },
    ]);

    return {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
      data,
    };
  }

  async findAllUserIds(): Promise<string[]> {
    const userIds = await this.chatModel.distinct('userId');
    return userIds.map((id) => id.toString());
  }

  async getMessagesByRoomFiltered({
    roomId,
    page = 1,
    limit = 10,
    search,
    sortBy,
    userId,
    actor,
  }: {
    roomId: string;
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    userId?: string;
    actor?: OwnershipActor | null;
  }) {
    this.assertCanAccessChatResource({ actor, roomId, userId });

    if (this.isSupportActor(actor)) {
      await this.markChatProcessing(roomId, actor);
    }

    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;

    const query: any = { roomId };

    if (userId) query.userId = userId;
    if (search) query.text = { $regex: search, $options: 'i' };

    const sort: any = {};
    if (sortBy) {
      sortBy.split(',').forEach((f) => {
        if (f.startsWith('-')) sort[f.slice(1)] = -1;
        else sort[f] = 1;
      });
    } else {
      sort.createdAt = 1;
    }

    const total = await this.chatModel.countDocuments(query);

    const data = await this.chatModel
      .find(query)
      .sort(sort)
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .exec();

    return {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
      data: this.isSupportActor(actor)
        ? data
        : data.map((message) => this.serializeCustomerMessage(message as any)),
    };
  }

  async getMessageWithUser(messageId: Types.ObjectId) {
    return this.chatModel
      .findById(messageId)
      .populate('userId', 'fullName email avatarUrl')
      .lean()
      .exec();
  }

  async editMessage(messageId: string, newText: string) {
    const message = await this.chatModel.findById(messageId);
    if (!message) throw new NotFoundException(`Message not found`);

    message.text = newText;
    await message.save();

    return this.getMessageWithUser(message._id);
  }

  async markAsRead(messageId: string) {
    return this.chatModel.findByIdAndUpdate(
      messageId,
      { isRead: true },
      { new: true },
    );
  }

  async markAsReadBulk(messageIds: string[]) {
    if (!messageIds || messageIds.length === 0) return;
    return this.chatModel.updateMany(
      { _id: { $in: messageIds } },
      { isRead: true },
    );
  }

  async markChatProcessing(roomId: string, actor?: OwnershipActor | null) {
    this.assertCanAccessChatRoom(actor, roomId);
    if (!this.isSupportActor(actor)) return null;
    return this.supportTicketService.markChatProcessing(roomId, actor);
  }

  async resolveChatTicket(roomId: string, actor?: OwnershipActor | null) {
    this.assertCanAccessChatRoom(actor, roomId);
    return this.supportTicketService.resolveChatTicket(roomId, actor);
  }

  async deleteMessageById(messageId: string) {
    const message = await this.chatModel.findById(messageId);
    if (!message) {
      throw new NotFoundException(`Message not found with id ${messageId}`);
    }

    message.isDeleted = true;
    await message.save();

    return { message: 'Message has been revoked', _id: message._id };
  }

  async deleteMessage(userId: string, actor?: OwnershipActor | null) {
    this.assertCanAccessChatResource({ actor, userId, targetType: 'chat messages' });

    const message = await this.chatModel.findOne({ userId });
    if (!message) {
      throw new NotFoundException(`No messages found for user ${userId}`);
    }
    await this.chatModel.deleteMany({ userId });
    return { message: 'Message deleted successfully' };
  }

  async deleteMessages(userIds: string[], actor?: OwnershipActor | null) {
    for (const userId of userIds) {
      this.assertCanAccessChatResource({ actor, userId, targetType: 'chat messages' });
    }

    const messages = await this.chatModel.find({ userId: { $in: userIds } });

    if (!messages || messages.length === 0) {
      throw new NotFoundException(
        `No messages found for users: ${userIds.join(', ')}`,
      );
    }

    await this.chatModel.deleteMany({ userId: { $in: userIds } });
    return { message: 'All messages deleted successfully' };
  }

  async getLatestMessage(userId: string) {
    return this.chatModel.findOne({ userId }).sort({ createdAt: -1 }).lean();
  }

  async resetUnreadCount(userId: string) {
    const latestMessage = await this.getLatestMessage(userId);
    if (!latestMessage) return;

    await this.chatModel.findByIdAndUpdate(latestMessage._id, {
      unreadCount: 0,
    });
  }
}

const CUSTOMER_METADATA_DENYLIST = new Set([
  'assistantHandoffSummary',
  'staffOnly',
  'staffSummary',
  'internalNotes',
  'queueId',
]);

function stripStaffOnlyMetadata(value: any): any {
  if (Array.isArray(value)) {
    return value
      .map((item) => stripStaffOnlyMetadata(item))
      .filter((item) => item !== undefined);
  }
  if (!value || typeof value !== 'object') return value;

  return Object.entries(value).reduce<Record<string, any>>((safe, [key, item]) => {
    if (CUSTOMER_METADATA_DENYLIST.has(key)) return safe;
    const next = stripStaffOnlyMetadata(item);
    if (next !== undefined) safe[key] = next;
    return safe;
  }, {});
}
