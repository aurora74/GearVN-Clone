import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';

import { UserRole } from '../auth/enums/user-role.enum';
import { SUPPORT_TICKET_SOURCE, SUPPORT_TICKET_STATUS } from '../config.global';
import { ChatService } from './chat.service';

const createChatModel = () => {
  const model: any = jest.fn().mockImplementation((data) => ({
    ...data,
    _id: new Types.ObjectId(),
    save: jest.fn().mockResolvedValue(undefined),
  }));

  model.findOne = jest.fn();
  model.findById = jest.fn();
  model.findByIdAndUpdate = jest.fn();
  model.updateMany = jest.fn();
  model.countDocuments = jest.fn();
  model.find = jest.fn();
  model.distinct = jest.fn();
  model.aggregate = jest.fn();

  return model;
};

describe('ChatService', () => {
  let chatModel: any;
  let cloudinaryService: any;
  let supportTicketService: any;
  let service: ChatService;

  beforeEach(() => {
    chatModel = createChatModel();
    cloudinaryService = {
      uploadImage: jest.fn().mockResolvedValue({ secure_url: 'https://cdn/image.png' }),
    };
    supportTicketService = {
      createOrRefreshForChat: jest.fn(),
      markChatProcessing: jest.fn(),
      resolveChatTicket: jest.fn(),
    };
    service = new ChatService(chatModel, cloudinaryService, supportTicketService);
  });

  it('rejects room access when the verified actor is neither owner nor CSR support', () => {
    expect(() =>
      service.assertCanAccessChatRoom(
        { id: 'customer-1', role: UserRole.CUSTOMER },
        'room-client-customer-2',
      ),
    ).toThrow(ForbiddenException);
  });

  it('creates or refreshes a chat support ticket for unread customer messages', async () => {
    const saved = await service.create(
      {
        text: 'Need support',
        roomId: 'room-client-customer-1',
        userId: 'customer-1',
        isRead: false,
        unreadCount: 1,
      },
      { id: 'customer-1', role: UserRole.CUSTOMER },
    );

    expect(saved.sender).toBe(UserRole.CUSTOMER);
    expect(supportTicketService.createOrRefreshForChat).toHaveBeenCalledWith({
      roomId: 'room-client-customer-1',
      customerId: 'customer-1',
      latestMessageId: saved._id.toString(),
      contextLabel: 'Chat khách hàng',
    });
  });

  it('marks active chat tickets processing on CSR room open/read and resolves manually', async () => {
    const actor = { id: 'csr-1', role: UserRole.CSR };

    await service.markChatProcessing('room-client-customer-1', actor);
    await service.resolveChatTicket('room-client-customer-1', actor);

    expect(supportTicketService.markChatProcessing).toHaveBeenCalledWith(
      'room-client-customer-1',
      actor,
    );
    expect(supportTicketService.resolveChatTicket).toHaveBeenCalledWith(
      'room-client-customer-1',
      actor,
    );
  });

  it('validates image uploads before Cloudinary upload side effects', async () => {
    await expect(
      service.uploadFiles([
        { mimetype: 'application/pdf', size: 1000 } as Express.Multer.File,
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();
  });
});
