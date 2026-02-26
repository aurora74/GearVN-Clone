import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { SUPPORT_TICKET_SOURCE, SUPPORT_TICKET_STATUS } from '../config.global';
import { SupportTicketService } from './support-ticket.service';

const createTicketModel = () => {
  const model: any = jest.fn().mockImplementation((data) => ({
    ...data,
    _id: new Types.ObjectId(),
    save: jest.fn().mockResolvedValue(undefined),
  }));

  model.findOne = jest.fn();
  model.find = jest.fn();
  model.findById = jest.fn();
  model.findByIdAndUpdate = jest.fn();
  model.countDocuments = jest.fn();

  return model;
};

describe('SupportTicketService', () => {
  let ticketModel: any;
  let service: SupportTicketService;

  beforeEach(() => {
    ticketModel = createTicketModel();
    service = new SupportTicketService(ticketModel);
  });

  it('creates one new product_qna ticket and reuses an existing ticket for the same source', async () => {
    const sourceId = new Types.ObjectId().toString();
    const existingTicket = {
      _id: new Types.ObjectId(),
      sourceType: SUPPORT_TICKET_SOURCE.PRODUCT_QNA,
      sourceId,
      status: SUPPORT_TICKET_STATUS.NEW,
    };

    ticketModel.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existingTicket);

    const created = await service.createForProductQuestion({
      questionId: sourceId,
      productId: new Types.ObjectId().toString(),
      customerId: new Types.ObjectId().toString(),
      contextLabel: 'Laptop gaming',
    });
    const reused = await service.createForProductQuestion({
      questionId: sourceId,
      productId: new Types.ObjectId().toString(),
      customerId: new Types.ObjectId().toString(),
      contextLabel: 'Laptop gaming',
    });

    expect(ticketModel).toHaveBeenCalledTimes(1);
    expect(created).toEqual(
      expect.objectContaining({
        sourceType: SUPPORT_TICKET_SOURCE.PRODUCT_QNA,
        sourceId,
        status: SUPPORT_TICKET_STATUS.NEW,
      }),
    );
    expect(reused).toBe(existingTicket);
  });

  it('supports only new, processing, and resolved status transitions', async () => {
    const ticket = {
      _id: new Types.ObjectId(),
      status: SUPPORT_TICKET_STATUS.NEW,
      resolvedAt: null,
      latestActivityAt: new Date(),
      save: jest.fn().mockResolvedValue(undefined),
    };
    ticketModel.findById.mockResolvedValue(ticket);

    await expect(
      service.updateStatus(ticket._id.toString(), SUPPORT_TICKET_STATUS.PROCESSING),
    ).resolves.toEqual(expect.objectContaining({ status: SUPPORT_TICKET_STATUS.PROCESSING }));
    await expect(
      service.updateStatus(ticket._id.toString(), SUPPORT_TICKET_STATUS.RESOLVED),
    ).resolves.toEqual(
      expect.objectContaining({
        status: SUPPORT_TICKET_STATUS.RESOLVED,
        resolvedAt: expect.any(Date),
      }),
    );
    await expect(
      service.updateStatus(ticket._id.toString(), SUPPORT_TICKET_STATUS.NEW),
    ).resolves.toEqual(expect.objectContaining({ status: SUPPORT_TICKET_STATUS.NEW }));
    await expect(service.updateStatus(ticket._id.toString(), 'closed' as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('marks a ticket processing when opened', async () => {
    const ticket = {
      _id: new Types.ObjectId(),
      status: SUPPORT_TICKET_STATUS.NEW,
      latestActivityAt: new Date(),
      save: jest.fn().mockResolvedValue(undefined),
    };
    ticketModel.findById.mockResolvedValue(ticket);

    const result = await service.openTicket(ticket._id.toString());

    expect(result.status).toBe(SUPPORT_TICKET_STATUS.PROCESSING);
    expect(ticket.save).toHaveBeenCalled();
  });

  it('creates or refreshes a single active chat ticket by room', async () => {
    const roomId = 'room-client-customer-1';
    const existingTicket = {
      _id: new Types.ObjectId(),
      sourceType: SUPPORT_TICKET_SOURCE.CHAT,
      roomId,
      status: SUPPORT_TICKET_STATUS.PROCESSING,
      metadata: {},
      save: jest.fn().mockResolvedValue(undefined),
    };

    ticketModel.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existingTicket);

    const created = await service.createOrRefreshForChat({
      roomId,
      customerId: new Types.ObjectId().toString(),
      latestMessageId: new Types.ObjectId().toString(),
      contextLabel: 'Chat khách hàng',
    });
    const refreshed = await service.createOrRefreshForChat({
      roomId,
      customerId: new Types.ObjectId().toString(),
      latestMessageId: new Types.ObjectId().toString(),
      contextLabel: 'Chat khách hàng',
    });

    expect(ticketModel).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: SUPPORT_TICKET_SOURCE.CHAT,
        roomId,
        status: SUPPORT_TICKET_STATUS.NEW,
      }),
    );
    expect(created).toEqual(expect.objectContaining({ sourceType: SUPPORT_TICKET_SOURCE.CHAT }));
    expect(refreshed.status).toBe(SUPPORT_TICKET_STATUS.NEW);
    expect(existingTicket.save).toHaveBeenCalled();
  });

  it('marks chat tickets processing and resolved through CSR support actors only', async () => {
    const ticket = {
      _id: new Types.ObjectId(),
      sourceType: SUPPORT_TICKET_SOURCE.CHAT,
      roomId: 'room-client-customer-1',
      status: SUPPORT_TICKET_STATUS.NEW,
      latestActivityAt: new Date(),
      resolvedAt: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    ticketModel.findOne.mockResolvedValue(ticket);

    await service.markChatProcessing('room-client-customer-1', { id: 'csr-1', role: 'CSR' as any });
    expect(ticket.status).toBe(SUPPORT_TICKET_STATUS.PROCESSING);

    await service.resolveChatTicket('room-client-customer-1', { id: 'csr-1', role: 'CSR' as any });
    expect(ticket.status).toBe(SUPPORT_TICKET_STATUS.RESOLVED);
    expect(ticket.resolvedAt).toBeInstanceOf(Date);

    await expect(
      service.markChatProcessing('room-client-customer-1', {
        id: 'admin-1',
        role: 'ADMIN' as any,
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('throws when updating a missing ticket', async () => {
    ticketModel.findById.mockResolvedValue(null);

    await expect(
      service.updateStatus(new Types.ObjectId().toString(), SUPPORT_TICKET_STATUS.RESOLVED),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
