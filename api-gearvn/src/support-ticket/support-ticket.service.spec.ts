import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { SUPPORT_TICKET_SOURCE, SUPPORT_TICKET_STATUS } from '../config.global';
import { SupportTicketSchema } from './support-ticket.schema';
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
  model.aggregate = jest.fn();
  model.updateOne = jest.fn();

  return model;
};

describe('SupportTicketService', () => {
  let ticketModel: any;
  let service: SupportTicketService;

  beforeEach(() => {
    ticketModel = createTicketModel();
    service = new SupportTicketService(ticketModel);
  });

  it('scopes the unique source index to product Q&A tickets with source ids', () => {
    const sourceIndex = SupportTicketSchema.indexes().find(
      ([fields, options]) => {
        return (
          fields.sourceType === 1 && fields.sourceId === 1 && options.unique
        );
      },
    );

    expect(sourceIndex).toBeDefined();
    expect(sourceIndex?.[1]).toEqual(
      expect.objectContaining({
        unique: true,
        partialFilterExpression: {
          sourceType: SUPPORT_TICKET_SOURCE.PRODUCT_QNA,
          sourceId: { $type: 'string' },
        },
      }),
    );
    expect(sourceIndex?.[1]).not.toEqual(
      expect.objectContaining({ sparse: true }),
    );
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
    const firstMessageId = new Types.ObjectId().toString();
    const refreshedMessageId = new Types.ObjectId().toString();
    const existingTicket = {
      _id: new Types.ObjectId(),
      sourceType: SUPPORT_TICKET_SOURCE.CHAT,
      sourceId: firstMessageId,
      roomId,
      status: SUPPORT_TICKET_STATUS.PROCESSING,
      metadata: {},
      save: jest.fn().mockResolvedValue(undefined),
    };

    ticketModel.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existingTicket);

    const created = await service.createOrRefreshForChat({
      roomId,
      customerId: new Types.ObjectId().toString(),
      latestMessageId: firstMessageId,
      contextLabel: 'Chat khách hàng',
    });
    const refreshed = await service.createOrRefreshForChat({
      roomId,
      customerId: new Types.ObjectId().toString(),
      latestMessageId: refreshedMessageId,
      contextLabel: 'Chat khách hàng',
    });

    expect(ticketModel).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: SUPPORT_TICKET_SOURCE.CHAT,
        sourceId: firstMessageId,
        roomId,
        status: SUPPORT_TICKET_STATUS.NEW,
      }),
    );
    expect(created).toEqual(
      expect.objectContaining({
        sourceType: SUPPORT_TICKET_SOURCE.CHAT,
        sourceId: firstMessageId,
      }),
    );
    expect(refreshed.status).toBe(SUPPORT_TICKET_STATUS.NEW);
    expect(refreshed.sourceId).toBe(firstMessageId);
    expect(existingTicket.save).toHaveBeenCalled();
  });

  it('stores synthetic chat customer ids in metadata instead of the ObjectId field', async () => {
    const roomId = 'room-client-debug-livestream-1778926079006-customer';
    const syntheticCustomerId = 'debug-livestream-1778926079006-customer';
    const latestMessageId = new Types.ObjectId().toString();

    ticketModel.findOne.mockResolvedValue(null);

    await service.createOrRefreshForChat({
      roomId,
      customerId: syntheticCustomerId,
      latestMessageId,
      contextLabel: 'Chat khách hàng',
    });

    expect(ticketModel).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId,
        customerId: undefined,
        metadata: expect.objectContaining({
          latestMessageId,
          rawCustomerId: syntheticCustomerId,
        }),
      }),
    );
  });

  it('backfills missing source ids on legacy active chat tickets', async () => {
    const roomId = 'room-client-customer-1';
    const latestMessageId = new Types.ObjectId().toString();
    const existingTicket = {
      _id: new Types.ObjectId(),
      sourceType: SUPPORT_TICKET_SOURCE.CHAT,
      sourceId: null,
      roomId,
      status: SUPPORT_TICKET_STATUS.PROCESSING,
      metadata: {},
      save: jest.fn().mockResolvedValue(undefined),
    };

    ticketModel.findOne.mockResolvedValue(existingTicket);

    const refreshed = await service.createOrRefreshForChat({
      roomId,
      customerId: new Types.ObjectId().toString(),
      latestMessageId,
      contextLabel: 'Chat khách hàng',
    });

    expect(ticketModel).not.toHaveBeenCalled();
    expect(refreshed.sourceId).toBe(latestMessageId);
    expect(existingTicket.save).toHaveBeenCalled();
  });

  it('persists staff-only assistant handoff metadata on chat ticket create and refresh', async () => {
    const roomId = 'room-client-customer-1';
    const firstMessageId = new Types.ObjectId().toString();
    const refreshedMessageId = new Types.ObjectId().toString();
    const initialSummary = {
      staffOnly: true,
      need: 'Laptop gaming kiêm đồ họa',
      confidence: 'medium',
    };
    const refreshedSummary = {
      staffOnly: true,
      need: 'Laptop gaming kiêm đồ họa',
      uncertainty: 'chưa xác minh tồn kho chi nhánh',
    };
    const existingTicket = {
      _id: new Types.ObjectId(),
      sourceType: SUPPORT_TICKET_SOURCE.CHAT,
      roomId,
      status: SUPPORT_TICKET_STATUS.PROCESSING,
      metadata: {
        latestMessageId: firstMessageId,
        previousContext: 'existing metadata survives',
        assistantHandoffSummary: initialSummary,
      },
      save: jest.fn().mockResolvedValue(undefined),
    };

    ticketModel.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existingTicket);

    const created = await service.createOrRefreshForChat({
      roomId,
      customerId: new Types.ObjectId().toString(),
      latestMessageId: firstMessageId,
      contextLabel: 'Chat khách hàng',
      metadata: {
        assistantHandoffSummary: initialSummary,
      },
    });
    const refreshed = await service.createOrRefreshForChat({
      roomId,
      customerId: new Types.ObjectId().toString(),
      latestMessageId: refreshedMessageId,
      contextLabel: 'Chat khách hàng',
      metadata: {
        assistantHandoffSummary: refreshedSummary,
      },
    });

    expect(ticketModel).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          latestMessageId: firstMessageId,
          assistantHandoffSummary: initialSummary,
        }),
      }),
    );
    expect(created.metadata.assistantHandoffSummary).toBe(initialSummary);
    expect(refreshed.metadata).toEqual(
      expect.objectContaining({
        latestMessageId: refreshedMessageId,
        previousContext: 'existing metadata survives',
        assistantHandoffSummary: refreshedSummary,
      }),
    );
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

  it('lists tickets through a safe customer lookup pipeline that preserves synthetic ids', async () => {
    const syntheticCustomerId = 'debug-livestream-1778926079006-customer';
    ticketModel.aggregate.mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        sourceType: SUPPORT_TICKET_SOURCE.CHAT,
        customerId: syntheticCustomerId,
        metadata: { rawCustomerId: syntheticCustomerId },
      },
    ]);
    ticketModel.countDocuments.mockResolvedValue(1);

    const result = await service.list({ page: 1, limit: 5 });
    const pipeline = JSON.stringify(ticketModel.aggregate.mock.calls[0][0]);

    expect(pipeline).toContain('"$convert"');
    expect(pipeline).not.toContain('populate');
    expect(result.data[0].customerId).toBe(syntheticCustomerId);
  });

  it('opens a ticket through aggregation without populating invalid customer ids', async () => {
    const ticketId = new Types.ObjectId();
    const latestActivityAt = new Date('2026-05-01T00:00:00Z');
    jest.useFakeTimers().setSystemTime(latestActivityAt);
    ticketModel.aggregate.mockResolvedValue([
      {
        _id: ticketId,
        status: SUPPORT_TICKET_STATUS.NEW,
        customerId: 'debug-livestream-1778926079006-customer',
      },
    ]);
    ticketModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const result = await service.findOne(ticketId.toString());

    expect(result.status).toBe(SUPPORT_TICKET_STATUS.PROCESSING);
    expect(ticketModel.updateOne).toHaveBeenCalledWith(
      { _id: ticketId },
      {
        $set: {
          status: SUPPORT_TICKET_STATUS.PROCESSING,
          latestActivityAt,
        },
      },
    );
    expect(JSON.stringify(ticketModel.aggregate.mock.calls[0][0])).toContain('"$convert"');
    jest.useRealTimers();
  });
});
