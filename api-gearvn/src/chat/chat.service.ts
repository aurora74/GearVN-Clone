import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, NotFoundException } from '@nestjs/common';

import { Chat, ChatDocument } from './chat.schema';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async create(message: Partial<Chat>) {
    const chat = new this.chatModel(message);
    return chat.save();
  }

  async uploadFiles(files: Express.Multer.File[]): Promise<string[]> {
    if (!files || files.length === 0) return [];

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
  }: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    roomId?: string;
    userId?: string;
  }) {
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
      data,
    };
  }

  async findLatestPerUser({
    page = 1,
    limit = 10,
    search,
    sortBy,
    roomId,
    userId,
  }: {
    page?: number | string;
    limit?: number | string;
    search?: string;
    sortBy?: string;
    roomId?: string;
    userId?: string;
  }) {
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
            _id: '$user._id',
            fullName: '$user.fullName',
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
  }: {
    roomId: string;
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    userId?: string;
  }) {
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;

    const query: any = { roomId };

    if (userId) query.sender = userId;
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
      data,
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

  async deleteMessageById(messageId: string) {
    const message = await this.chatModel.findById(messageId);
    if (!message) {
      throw new NotFoundException(`Message not found with id ${messageId}`);
    }

    message.isDeleted = true;
    await message.save();

    return { message: 'Message has been revoked', _id: message._id };
  }

  async deleteMessage(userId: string) {
    const message = await this.chatModel.findOne({ userId });
    if (!message) {
      throw new NotFoundException(`No messages found for user ${userId}`);
    }
    await this.chatModel.deleteMany({ userId });
    return { message: 'Message deleted successfully' };
  }

  async deleteMessages(userIds: string[]) {
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
