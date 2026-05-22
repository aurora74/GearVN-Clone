import { ForbiddenException } from '@nestjs/common';

import { UserRole } from '../auth/enums/user-role.enum';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

const createSocket = (overrides: Partial<any> = {}) => {
  const room = { emit: jest.fn() };

  return {
    handshake: {
      auth: {},
      query: {},
      headers: {},
      ...(overrides.handshake ?? {}),
    },
    data: overrides.data ?? {},
    join: jest.fn(),
    emit: jest.fn(),
    to: jest.fn(() => room),
    on: jest.fn(),
    disconnect: jest.fn(),
    ...overrides,
  };
};

const createChatModel = () => {
  const model: any = jest.fn().mockImplementation((data) => ({
    ...data,
    _id: { toString: () => 'message-1' },
    save: jest.fn().mockResolvedValue(undefined),
  }));

  return model;
};

const createChatService = () => {
  const chatModel = createChatModel();
  const supportTicketService = {
    createOrRefreshForChat: jest.fn(),
    markChatProcessing: jest.fn(),
    resolveChatTicket: jest.fn(),
  };
  const service = new ChatService(
    chatModel,
    { uploadImage: jest.fn() } as any,
    supportTicketService as any,
  );

  return { chatModel, service, supportTicketService };
};

describe('ChatGateway', () => {
  const room = {
    emit: jest.fn(),
  };
  const server = {
    to: jest.fn(() => room),
  };
  const chatService = {
    findAllUserIds: jest.fn(),
    getLatestMessage: jest.fn(),
    create: jest.fn(),
    getMessageWithUser: jest.fn(),
    editMessage: jest.fn(),
    deleteMessageById: jest.fn(),
    markAsRead: jest.fn(),
    markAsReadBulk: jest.fn(),
    resetUnreadCount: jest.fn(),
    assertCanAccessChatRoom: jest.fn(),
    isSupportActor: jest.fn(),
    createInternalMessage: jest.fn(),
    serializeCustomerMessage: jest.fn((message) => message),
    markChatProcessing: jest.fn(),
  };
  const chatAuthService = {
    authenticateSocket: jest.fn(),
  };
  const assistantService = {
    invokeForChatMessage: jest.fn(),
    handoffToStaff: jest.fn(),
  };
  const assistantSessionService = {
    getMode: jest.fn(),
    setMode: jest.fn(),
    findPendingActionDraft: jest.fn(),
    consumeActionDraft: jest.fn(),
  };
  const assistantActionAdapter = {
    confirmActionDraft: jest.fn(),
    validateConfirmedAction: jest.fn(),
    createOrder: jest.fn(),
    createPayment: jest.fn(),
    decrementInventory: jest.fn(),
    reserveVoucher: jest.fn(),
    findProductSnapshot: jest.fn(),
  };
  const voucherAdapter = {
    validatePublic: jest.fn(),
  };

  let gateway: ChatGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new ChatGateway(
      chatService as any,
      chatAuthService as any,
      assistantService as any,
      assistantSessionService as any,
      assistantActionAdapter as any,
      voucherAdapter as any,
    );
    gateway.server = server as any;
    chatService.findAllUserIds.mockResolvedValue(['customer-1']);
    chatService.isSupportActor.mockReturnValue(false);
    chatService.assertCanAccessChatRoom.mockReturnValue('customer-1');
    chatService.getLatestMessage.mockResolvedValue(null);
    chatService.create.mockResolvedValue({
      _id: { toString: () => 'message-1' },
    });
    chatService.getMessageWithUser.mockResolvedValue({
      _id: 'message-1',
      text: 'saved',
    });
    chatService.createInternalMessage.mockResolvedValue({
      _id: { toString: () => 'assistant-1' },
    });
    assistantSessionService.getMode.mockResolvedValue('ai');
    assistantSessionService.setMode.mockResolvedValue({ mode: 'ai' });
    assistantService.invokeForChatMessage.mockResolvedValue({
      status: 'completed',
      text: 'AI trả lời',
      metadata: { kind: 'assistant' },
    });
    assistantActionAdapter.confirmActionDraft.mockReturnValue(true);
    assistantActionAdapter.findProductSnapshot.mockResolvedValue({
      id: 'product-1',
      slug: 'laptop-a',
      name: 'Laptop A',
      price: 15000000,
      image: 'https://cdn.example.test/laptop-a.jpg',
      stock: 10,
      isPublished: true,
      isArchived: false,
    });
    voucherAdapter.validatePublic.mockResolvedValue({ valid: true });
    assistantService.handoffToStaff.mockResolvedValue({
      type: 'staff_handoff',
    });
  });

  it('does not join support rooms from spoofed ADMIN query params', async () => {
    chatAuthService.authenticateSocket.mockResolvedValue({
      id: 'customer-1',
      role: UserRole.CUSTOMER,
    });
    const socket = createSocket({
      handshake: { query: { role: UserRole.ADMIN, userId: 'customer-2' } },
    });

    await gateway.handleConnection(socket as any);

    expect(socket.join).toHaveBeenCalledWith('room-client-customer-1');
    expect(socket.join).not.toHaveBeenCalledWith('support-operators');
    expect(socket.join).not.toHaveBeenCalledWith('room-client-customer-2');
  });

  it('rejects message mutation before persistence when verified actor cannot access the room', async () => {
    chatService.assertCanAccessChatRoom.mockImplementation(() => {
      throw new ForbiddenException('denied');
    });
    const socket = createSocket({
      data: { actor: { id: 'customer-1', role: UserRole.CUSTOMER } },
    });

    await gateway.handleMessage(
      {
        sender: UserRole.ADMIN as any,
        text: 'spoofed',
        roomId: 'room-client-customer-2',
        userId: 'customer-2',
      },
      socket as any,
    );

    expect(chatService.create).not.toHaveBeenCalled();
    expect(server.to).not.toHaveBeenCalledWith('room-client-customer-2');
    expect(socket.emit).toHaveBeenCalledWith('chat-error', expect.any(Object));
  });

  it('allows CSR support operators to join customer rooms', async () => {
    chatAuthService.authenticateSocket.mockResolvedValue({
      id: 'csr-1',
      role: UserRole.CSR,
    });
    chatService.isSupportActor.mockReturnValue(true);
    const socket = createSocket();

    await gateway.handleConnection(socket as any);
    await gateway.handleJoinRoom('room-client-customer-1', socket as any);

    expect(socket.join).toHaveBeenCalledWith('support-operators');
    expect(socket.join).toHaveBeenCalledWith('room-client-customer-1:staff');
  });

  it('invokes the assistant after customer messages are persisted in AI mode', async () => {
    chatService.getMessageWithUser
      .mockResolvedValueOnce({ _id: 'customer-message', text: 'Tư vấn laptop' })
      .mockResolvedValueOnce({ _id: 'assistant-message', text: 'AI trả lời' });
    const socket = createSocket({
      data: { actor: { id: 'customer-1', role: UserRole.CUSTOMER } },
    });

    await gateway.handleMessage(
      {
        sender: UserRole.CUSTOMER as any,
        text: 'Tư vấn laptop',
        roomId: 'room-client-customer-1',
      },
      socket as any,
    );

    expect(assistantSessionService.getMode).toHaveBeenCalledWith(
      'room-client-customer-1',
    );
    expect(assistantService.invokeForChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'room-client-customer-1',
        authenticatedUserId: 'customer-1',
        text: 'Tư vấn laptop',
        attachments: [],
        signal: expect.any(AbortSignal),
      }),
    );
    expect(chatService.create.mock.invocationCallOrder[0]).toBeLessThan(
      assistantService.invokeForChatMessage.mock.invocationCallOrder[0],
    );
    expect(chatService.createInternalMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'room-client-customer-1',
        userId: 'customer-1',
        sender: UserRole.ADMIN,
        messageKind: 'assistant',
        metadata: expect.objectContaining({ kind: 'assistant' }),
      }),
    );
    expect(socket.emit).toHaveBeenCalledWith(
      'receive-message',
      expect.objectContaining({ _id: 'assistant-message' }),
    );
  });

  it('serializes assistant invocations per room to keep prompt context ordered', async () => {
    let resolveFirstAssistant!: (value: unknown) => void;
    const firstAssistant = new Promise((resolve) => {
      resolveFirstAssistant = resolve;
    });
    assistantService.invokeForChatMessage
      .mockReturnValueOnce(firstAssistant as any)
      .mockResolvedValueOnce({
        status: 'completed',
        text: 'AI trả lời lượt 2',
        metadata: { kind: 'assistant' },
      });
    chatService.create
      .mockResolvedValueOnce({ _id: { toString: () => 'customer-1' } })
      .mockResolvedValueOnce({ _id: { toString: () => 'customer-2' } })
      .mockResolvedValueOnce({ _id: { toString: () => 'assistant-1' } })
      .mockResolvedValueOnce({ _id: { toString: () => 'assistant-2' } });
    chatService.createInternalMessage
      .mockResolvedValueOnce({ _id: { toString: () => 'assistant-1' } })
      .mockResolvedValueOnce({ _id: { toString: () => 'assistant-2' } });
    chatService.getMessageWithUser.mockImplementation((id) =>
      Promise.resolve({ _id: id?.toString?.() ?? String(id), text: 'saved' }),
    );
    const socket = createSocket({
      data: { actor: { id: 'customer-1', role: UserRole.CUSTOMER } },
    });

    const first = gateway.handleMessage(
      {
        sender: UserRole.CUSTOMER as any,
        text: 'mình cần tư vấn laptop',
        roomId: 'room-client-customer-1',
      },
      socket as any,
    );
    const second = gateway.handleMessage(
      {
        sender: UserRole.CUSTOMER as any,
        text: 'tối đa 25 triệu',
        roomId: 'room-client-customer-1',
      },
      socket as any,
    );

    await new Promise((resolve) => setImmediate(resolve));
    expect(assistantService.invokeForChatMessage).toHaveBeenCalledTimes(1);

    resolveFirstAssistant({
      status: 'completed',
      text: 'AI trả lời lượt 1',
      metadata: { kind: 'assistant' },
    });
    await Promise.all([first, second]);

    expect(assistantService.invokeForChatMessage).toHaveBeenCalledTimes(2);
    expect(assistantService.invokeForChatMessage.mock.calls[0][0].text).toBe(
      'mình cần tư vấn laptop',
    );
    expect(assistantService.invokeForChatMessage.mock.calls[1][0].text).toBe(
      'tối đa 25 triệu',
    );
  });

  it('persists a customer-visible assistant fallback when AI invocation fails', async () => {
    assistantService.invokeForChatMessage.mockRejectedValue(
      new Error('Missing AI retrieval env vars: OPENROUTER_API_KEY'),
    );
    chatService.getMessageWithUser
      .mockResolvedValueOnce({
        _id: 'customer-message',
        text: 'mình cần mua máy tính',
      })
      .mockResolvedValueOnce({
        _id: 'assistant-fallback',
        text: 'Mình chưa kết nối được dịch vụ AI để xử lý yêu cầu này.',
      });
    const socket = createSocket({
      data: { actor: { id: 'customer-1', role: UserRole.CUSTOMER } },
    });

    await gateway.handleMessage(
      {
        sender: UserRole.CUSTOMER as any,
        text: 'mình cần mua máy tính',
        roomId: 'room-client-customer-1',
      },
      socket as any,
    );

    expect(chatService.createInternalMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'room-client-customer-1',
        userId: 'customer-1',
        sender: UserRole.ADMIN,
        messageKind: 'assistant',
        metadata: expect.objectContaining({
          kind: 'assistant',
          mode: 'ai',
          error: { code: 'assistant_unavailable' },
        }),
      }),
    );
    expect(socket.emit).toHaveBeenCalledWith(
      'receive-message',
      expect.objectContaining({ _id: 'assistant-fallback' }),
    );
    expect(socket.emit).not.toHaveBeenCalledWith(
      'chat-error',
      expect.any(Object),
    );
  });

  it('suppresses stale assistant unavailable fallback when a newer customer message is queued', async () => {
    assistantService.invokeForChatMessage
      .mockRejectedValueOnce(new Error('assistant_invocation_timeout'))
      .mockResolvedValueOnce({
        status: 'completed',
        text: 'AI trả lời lượt 2',
        metadata: { kind: 'assistant' },
      });
    chatService.getMessageWithUser.mockImplementation((id) =>
      Promise.resolve({ _id: id?.toString?.() ?? String(id), text: 'saved' }),
    );
    chatService.createInternalMessage.mockResolvedValueOnce({
      _id: { toString: () => 'assistant-2' },
    });
    const socket = createSocket({
      data: { actor: { id: 'customer-1', role: UserRole.CUSTOMER } },
    });

    const first = gateway.handleMessage(
      {
        sender: UserRole.CUSTOMER as any,
        text: 'tư vấn laptop gaming khoảng 25 triệu',
        roomId: 'room-client-customer-1',
      },
      socket as any,
    );
    const second = gateway.handleMessage(
      {
        sender: UserRole.CUSTOMER as any,
        text: 'ưu tiên pin và mỏng nhẹ',
        roomId: 'room-client-customer-1',
      },
      socket as any,
    );

    await Promise.all([first, second]);

    expect(assistantService.invokeForChatMessage).toHaveBeenCalledTimes(2);
    expect(chatService.createInternalMessage).toHaveBeenCalledTimes(1);
    expect(chatService.createInternalMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'AI trả lời lượt 2',
        metadata: { kind: 'assistant' },
      }),
    );
    expect(chatService.createInternalMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          error: { code: 'assistant_unavailable' },
        }),
      }),
    );
  });

  it('aborts the assistant invocation when the gateway timeout fires', async () => {
    jest.useFakeTimers();
    try {
      assistantService.invokeForChatMessage.mockImplementation(
        ({ signal }: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('aborted')));
          }) as any,
      );
      chatService.getMessageWithUser
        .mockResolvedValueOnce({
          _id: 'customer-message',
          text: 'review chi tiết cho mình con Lenovo ThinkBook 14 G7 IML',
        })
        .mockResolvedValueOnce({
          _id: 'assistant-fallback',
          text: 'Mình chưa kết nối được dịch vụ AI để xử lý yêu cầu này.',
        });
      const socket = createSocket({
        data: { actor: { id: 'customer-1', role: UserRole.CUSTOMER } },
      });

      const pending = gateway.handleMessage(
        {
          sender: UserRole.CUSTOMER as any,
          text: 'review chi tiết cho mình con Lenovo ThinkBook 14 G7 IML',
          roomId: 'room-client-customer-1',
        },
        socket as any,
      );

      for (let attempt = 0; attempt < 10; attempt += 1) {
        if (assistantService.invokeForChatMessage.mock.calls.length > 0) break;
        await Promise.resolve();
      }
      expect(assistantService.invokeForChatMessage).toHaveBeenCalledTimes(1);

      const signal = assistantService.invokeForChatMessage.mock.calls[0][0]
        .signal as AbortSignal;
      expect(signal.aborted).toBe(false);

      await jest.advanceTimersByTimeAsync(55_000);
      await pending;

      expect(signal.aborted).toBe(true);
      expect(chatService.createInternalMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'room-client-customer-1',
          messageKind: 'assistant',
          metadata: expect.objectContaining({
            error: { code: 'assistant_unavailable' },
          }),
        }),
      );
      expect(socket.emit).toHaveBeenCalledWith(
        'receive-message',
        expect.objectContaining({ _id: 'assistant-fallback' }),
      );
    } finally {
      jest.useRealTimers();
    }
  });
  it('sends customer-safe assistant metadata to customer sockets and raw metadata only to staff rooms', () => {
    const customerRoom = { emit: jest.fn() };
    const staffRoom = { emit: jest.fn() };
    const rawMessage = {
      _id: 'assistant-message',
      text: 'handoff',
      metadata: {
        publicAction: 'handoff_started',
        assistantHandoffSummary: { need: 'Laptop gaming' },
      },
    };
    const safeMessage = {
      _id: 'assistant-message',
      text: 'handoff',
      metadata: { publicAction: 'handoff_started' },
    };
    chatService.serializeCustomerMessage.mockReturnValueOnce(safeMessage);
    const socket = createSocket({
      data: { actor: { id: 'customer-1', role: UserRole.CUSTOMER } },
      to: jest.fn((roomId) =>
        roomId === 'room-client-customer-1:staff' ? staffRoom : customerRoom,
      ),
    });
    gateway.server = {
      to: jest.fn((roomId) =>
        roomId === 'room-client-customer-1:staff' ? staffRoom : customerRoom,
      ),
    } as any;

    (gateway as any).emitMessageToRoom(
      socket,
      'room-client-customer-1',
      rawMessage,
    );

    expect(customerRoom.emit).toHaveBeenCalledWith(
      'receive-message',
      safeMessage,
    );
    expect(customerRoom.emit).not.toHaveBeenCalledWith(
      'receive-message',
      rawMessage,
    );
    expect(staffRoom.emit).toHaveBeenCalledWith('receive-message', rawMessage);
    expect(socket.emit).toHaveBeenCalledWith('receive-message', safeMessage);
  });

  it('does not invoke the assistant while the room is in staff mode', async () => {
    assistantSessionService.getMode.mockResolvedValue('staff');
    const socket = createSocket({
      data: { actor: { id: 'customer-1', role: UserRole.CUSTOMER } },
    });

    await gateway.handleMessage(
      {
        sender: UserRole.CUSTOMER as any,
        text: 'Nhân viên đang hỗ trợ',
        roomId: 'room-client-customer-1',
      },
      socket as any,
    );

    expect(assistantService.invokeForChatMessage).not.toHaveBeenCalled();
    expect(chatService.createInternalMessage).not.toHaveBeenCalled();
  });

  it('switches assistant mode through verified room access and emits the mode update', async () => {
    const socket = createSocket({
      data: { actor: { id: 'customer-1', role: UserRole.CUSTOMER } },
    });

    await gateway.handleAssistantSwitchMode(
      { roomId: 'room-client-customer-1', mode: 'staff' },
      socket as any,
    );

    expect(chatService.assertCanAccessChatRoom).toHaveBeenCalledWith(
      { id: 'customer-1', role: UserRole.CUSTOMER },
      'room-client-customer-1',
    );
    expect(assistantSessionService.setMode).toHaveBeenCalledWith(
      'room-client-customer-1',
      'staff',
    );
    expect(assistantService.handoffToStaff).toHaveBeenCalledWith({
      roomId: 'room-client-customer-1',
      authenticatedUserId: 'customer-1',
      latestMessage: 'Chat với nhân viên tư vấn',
      latestMessageId: 'message-1',
    });
    expect(chatService.create).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Chat với nhân viên tư vấn' }),
      { id: 'customer-1', role: UserRole.CUSTOMER },
    );
    expect(socket.emit).toHaveBeenCalledWith('assistant-mode-updated', {
      roomId: 'room-client-customer-1',
      mode: 'staff',
    });
  });

  it('confirms assistant action drafts only after backend validation', async () => {
    const draft = {
      draftId: 'draft-1',
      roomId: 'room-client-customer-1',
      customerId: 'customer-1',
      action: 'CART_ADD',
      kind: 'CART_ADD',
      status: 'pending',
      requiresConfirmation: true,
      displayText: 'Thêm Laptop A vào giỏ hàng',
      product: { id: 'product-1', name: 'Laptop A' },
      quantity: 1,
      expiresAt: new Date(Date.now() + 60_000),
      payload: { productId: 'product-1', quantity: 1 },
    };
    assistantSessionService.findPendingActionDraft.mockResolvedValue(draft);
    assistantSessionService.consumeActionDraft.mockResolvedValue(draft);
    const socket = createSocket({
      data: { actor: { id: 'customer-1', role: UserRole.CUSTOMER } },
    });

    await gateway.handleAssistantConfirmAction(
      {
        roomId: 'room-client-customer-1',
        draftId: 'draft-1',
      },
      socket as any,
    );

    expect(assistantSessionService.consumeActionDraft).toHaveBeenCalledWith(
      'room-client-customer-1',
      'draft-1',
    );
    expect(assistantActionAdapter.confirmActionDraft).toHaveBeenCalledWith(
      draft,
    );
    expect(chatService.createInternalMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Thêm Laptop A vào giỏ hàng',
        messageKind: 'system',
      }),
    );
    expect(socket.emit).toHaveBeenCalledWith(
      'assistant-action-confirmed',
      expect.objectContaining({
        draftId: 'draft-1',
        action: 'CART_ADD',
        productId: 'product-1',
        quantity: 1,
        cartItem: expect.objectContaining({
          id: 'product-1',
          slug: 'laptop-a',
          name: 'Laptop A',
          image: 'https://cdn.example.test/laptop-a.jpg',
          quantity: 1,
          finalPrice: 15000000,
        }),
        product: expect.objectContaining({
          productId: 'product-1',
          slug: 'laptop-a',
          name: 'Laptop A',
          image: 'https://cdn.example.test/laptop-a.jpg',
        }),
        confirmedByBackend: true,
      }),
    );
    expect(assistantActionAdapter.createOrder).not.toHaveBeenCalled();
    expect(assistantActionAdapter.createPayment).not.toHaveBeenCalled();
    expect(assistantActionAdapter.decrementInventory).not.toHaveBeenCalled();
    expect(assistantActionAdapter.reserveVoucher).not.toHaveBeenCalled();
  });

  it('uses active backend discount and product image when confirming assistant cart adds', async () => {
    const draft = {
      draftId: 'draft-sale-1',
      roomId: 'room-client-customer-1',
      customerId: 'customer-1',
      action: 'CART_ADD',
      kind: 'CART_ADD',
      status: 'pending',
      requiresConfirmation: true,
      displayText: 'Thêm Laptop Sale vào giỏ hàng',
      productId: 'product-sale-1',
      quantity: 2,
      expiresAt: new Date(Date.now() + 60_000),
      payload: { productId: 'product-sale-1', quantity: 2 },
    };
    assistantSessionService.findPendingActionDraft.mockResolvedValue(draft);
    assistantSessionService.consumeActionDraft.mockResolvedValue(draft);
    assistantActionAdapter.findProductSnapshot.mockResolvedValueOnce({
      id: 'product-sale-1',
      slug: 'laptop-sale',
      name: 'Laptop Sale',
      price: 28_990_000,
      discountPrice: 26_890_000,
      images: ['', 'https://cdn.example.test/laptop-sale.jpg'],
      stock: 10,
      isPublished: true,
      isArchived: false,
    });
    const socket = createSocket({
      data: { actor: { id: 'customer-1', role: UserRole.CUSTOMER } },
    });

    await gateway.handleAssistantConfirmAction(
      {
        roomId: 'room-client-customer-1',
        draftId: 'draft-sale-1',
      },
      socket as any,
    );

    expect(socket.emit).toHaveBeenCalledWith(
      'assistant-action-confirmed',
      expect.objectContaining({
        cartItem: expect.objectContaining({
          id: 'product-sale-1',
          price: 28_990_000,
          finalPrice: 26_890_000,
          clientFinalPrice: 26_890_000,
          image: 'https://cdn.example.test/laptop-sale.jpg',
        }),
        product: expect.objectContaining({
          price: 28_990_000,
          discountPrice: 26_890_000,
          image: 'https://cdn.example.test/laptop-sale.jpg',
        }),
      }),
    );
  });

  it('falls back to base price and default image when confirmation snapshot has no active sale or image', async () => {
    const draft = {
      draftId: 'draft-nosale-1',
      roomId: 'room-client-customer-1',
      customerId: 'customer-1',
      action: 'CART_ADD',
      kind: 'CART_ADD',
      status: 'pending',
      requiresConfirmation: true,
      displayText: 'Thêm Laptop thường vào giỏ hàng',
      productId: 'product-nosale-1',
      quantity: 1,
      expiresAt: new Date(Date.now() + 60_000),
      payload: { productId: 'product-nosale-1', quantity: 1 },
    };
    assistantSessionService.findPendingActionDraft.mockResolvedValue(draft);
    assistantSessionService.consumeActionDraft.mockResolvedValue(draft);
    assistantActionAdapter.findProductSnapshot.mockResolvedValueOnce({
      id: 'product-nosale-1',
      slug: 'laptop-nosale',
      name: 'Laptop thường',
      price: 28_990_000,
      stock: 10,
      isPublished: true,
      isArchived: false,
    });
    const socket = createSocket({
      data: { actor: { id: 'customer-1', role: UserRole.CUSTOMER } },
    });

    await gateway.handleAssistantConfirmAction(
      {
        roomId: 'room-client-customer-1',
        draftId: 'draft-nosale-1',
      },
      socket as any,
    );

    expect(socket.emit).toHaveBeenCalledWith(
      'assistant-action-confirmed',
      expect.objectContaining({
        cartItem: expect.objectContaining({
          id: 'product-nosale-1',
          price: 28_990_000,
          finalPrice: 28_990_000,
          image: '/avatar-default.jpg',
        }),
        product: expect.objectContaining({
          price: 28_990_000,
          discountPrice: undefined,
          image: '/avatar-default.jpg',
        }),
      }),
    );
  });

  it('confirms checkout redirect drafts from the stored backend draft without client echo fields', async () => {
    const checkout = {
      name: 'Nguyen Van A',
      phone: '0909123456',
      address: 'Quan 1, TP HCM',
    };
    const draft = {
      draftId: 'draft-checkout-1',
      roomId: 'room-client-customer-1',
      customerId: 'customer-1',
      action: 'CHECKOUT_REDIRECT',
      kind: 'CHECKOUT_REDIRECT',
      status: 'pending',
      requiresConfirmation: true,
      displayText: 'Đi tới thanh toán',
      checkout,
      voucherCode: 'TEST',
      redirectPath: '/cart?step=payment',
      expiresAt: new Date(Date.now() + 60_000),
      payload: {
        action: 'CHECKOUT_REDIRECT',
        checkout,
        voucherCode: 'TEST',
        redirectPath: '/cart?step=payment',
      },
    };
    assistantSessionService.findPendingActionDraft.mockResolvedValue(draft);
    assistantSessionService.consumeActionDraft.mockResolvedValue(draft);
    const socket = createSocket({
      data: { actor: { id: 'customer-1', role: UserRole.CUSTOMER } },
    });

    await gateway.handleAssistantConfirmAction(
      {
        roomId: 'room-client-customer-1',
        draftId: 'draft-checkout-1',
      },
      socket as any,
    );

    expect(assistantActionAdapter.findProductSnapshot).not.toHaveBeenCalled();
    expect(assistantSessionService.consumeActionDraft).toHaveBeenCalledWith(
      'room-client-customer-1',
      'draft-checkout-1',
    );
    expect(socket.emit).toHaveBeenCalledWith(
      'assistant-action-confirmed',
      expect.objectContaining({
        draftId: 'draft-checkout-1',
        action: 'CHECKOUT_REDIRECT',
        checkout,
        voucherCode: 'TEST',
        redirectPath: '/cart?step=payment',
        confirmedByBackend: true,
      }),
    );
  });
  it('rejects assistant action confirmation when the draft does not belong to the socket actor', async () => {
    assistantSessionService.findPendingActionDraft.mockResolvedValue({
      draftId: 'draft-1',
      roomId: 'room-client-customer-1',
      customerId: 'customer-2',
      action: 'CART_ADD',
      kind: 'CART_ADD',
      status: 'pending',
      requiresConfirmation: true,
      displayText: 'invalid',
      productId: 'product-1',
      quantity: 1,
      expiresAt: new Date(Date.now() + 60_000),
      payload: { productId: 'product-1', quantity: 1 },
    });
    const socket = createSocket({
      data: { actor: { id: 'customer-1', role: UserRole.CUSTOMER } },
    });

    await gateway.handleAssistantConfirmAction(
      {
        roomId: 'room-client-customer-1',
        draftId: 'draft-1',
        productId: 'product-1',
        quantity: 1,
      },
      socket as any,
    );

    expect(assistantActionAdapter.confirmActionDraft).not.toHaveBeenCalled();
    expect(assistantSessionService.consumeActionDraft).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('chat-error', expect.any(Object));
  });

  it.each([
    [
      'expired draft',
      { expiresAt: new Date(Date.now() - 60_000) },
      { productId: 'product-1', quantity: 1 },
    ],
    [
      'missing product identity in stored draft',
      { productId: undefined, product: undefined, payload: { quantity: 1 } },
      {},
    ],
    [
      'mismatched product identity',
      {},
      { productId: 'product-2' },
    ],
    [
      'missing quantity in stored draft',
      { quantity: undefined, payload: { productId: 'product-1' } },
      {},
    ],
    [
      'mismatched quantity',
      {},
      { quantity: 2 },
    ],
    [
      'missing voucher in stored draft',
      {
        action: 'APPLY_VOUCHER',
        kind: 'APPLY_VOUCHER',
        productId: undefined,
        quantity: undefined,
        voucherCode: undefined,
        payload: { action: 'APPLY_VOUCHER' },
      },
      {},
    ],
    [
      'mismatched voucher',
      {
        action: 'APPLY_VOUCHER',
        kind: 'APPLY_VOUCHER',
        productId: undefined,
        quantity: undefined,
        voucherCode: 'SAVE10',
        payload: { action: 'APPLY_VOUCHER', voucherCode: 'SAVE10' },
      },
      { voucherCode: 'SAVE20' },
    ],
    [
      'missing checkout fields in stored draft',
      {
        action: 'CHECKOUT_REDIRECT',
        kind: 'CHECKOUT_REDIRECT',
        productId: undefined,
        quantity: undefined,
        checkout: {
          name: 'Nguyen Van A',
          phone: '',
          address: 'Quan 1, TP HCM',
        },
        payload: {
          action: 'CHECKOUT_REDIRECT',
          checkout: {
            name: 'Nguyen Van A',
            phone: '',
            address: 'Quan 1, TP HCM',
          },
          redirectPath: '/cart?step=payment',
        },
      },
      {},
    ],
    [
      'mismatched checkout fields',
      {
        action: 'CHECKOUT_REDIRECT',
        kind: 'CHECKOUT_REDIRECT',
        productId: undefined,
        quantity: undefined,
        checkout: {
          name: 'Nguyen Van A',
          phone: '0909123456',
          address: 'Quan 1, TP HCM',
        },
        payload: {
          action: 'CHECKOUT_REDIRECT',
          checkout: {
            name: 'Nguyen Van A',
            phone: '0909123456',
            address: 'Quan 1, TP HCM',
          },
          redirectPath: '/cart?step=payment',
        },
      },
      {
        checkout: {
          name: 'Nguyen Van B',
          phone: '0909123456',
          address: 'Quan 1, TP HCM',
        },
      },
    ],
  ])('rejects assistant-confirm-action for %s before emitting confirmation', async (_label, draftOverrides, payloadOverrides) => {
    const draft = {
      draftId: 'draft-1',
      roomId: 'room-client-customer-1',
      customerId: 'customer-1',
      action: 'CART_ADD',
      kind: 'CART_ADD',
      status: 'pending',
      requiresConfirmation: true,
      displayText: 'Thêm Laptop A vào giỏ hàng',
      productId: 'product-1',
      quantity: 1,
      expiresAt: new Date(Date.now() + 60_000),
      payload: { productId: 'product-1', quantity: 1 },
      ...(draftOverrides as Record<string, unknown>),
    };
    assistantSessionService.findPendingActionDraft.mockResolvedValue(draft);
    const socket = createSocket({
      data: { actor: { id: 'customer-1', role: UserRole.CUSTOMER } },
    });

    await gateway.handleAssistantConfirmAction(
      {
        roomId: 'room-client-customer-1',
        draftId: 'draft-1',
        ...(payloadOverrides as Record<string, unknown>),
      },
      socket as any,
    );

    expect(assistantActionAdapter.confirmActionDraft).not.toHaveBeenCalled();
    expect(assistantSessionService.consumeActionDraft).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('chat-error', expect.any(Object));
    expect(socket.emit).not.toHaveBeenCalledWith(
      'assistant-action-confirmed',
      expect.any(Object),
    );
  });

  it('does not consume an action draft when backend revalidation fails', async () => {
    assistantSessionService.findPendingActionDraft.mockResolvedValue({
      draftId: 'draft-1',
      roomId: 'room-client-customer-1',
      customerId: 'customer-1',
      action: 'CART_ADD',
      kind: 'CART_ADD',
      status: 'pending',
      requiresConfirmation: true,
      displayText: 'invalid',
      productId: 'product-1',
      quantity: 1,
      expiresAt: new Date(Date.now() + 60_000),
      payload: { productId: 'product-1', quantity: 1 },
    });
    assistantActionAdapter.findProductSnapshot.mockResolvedValueOnce(null);
    const socket = createSocket({
      data: { actor: { id: 'customer-1', role: UserRole.CUSTOMER } },
    });

    await gateway.handleAssistantConfirmAction(
      {
        roomId: 'room-client-customer-1',
        draftId: 'draft-1',
        productId: 'product-1',
        quantity: 1,
      },
      socket as any,
    );

    expect(assistantSessionService.consumeActionDraft).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('chat-error', expect.any(Object));
  });
});

describe('ChatService assistant metadata', () => {
  it('persists assistant messages with metadata through the internal service path', async () => {
    const { chatModel, service, supportTicketService } = createChatService();

    const saved = await service.createInternalMessage({
      roomId: 'room-client-customer-1',
      userId: 'customer-1',
      text: 'Đây là gợi ý phù hợp cho bạn.',
      sender: UserRole.ADMIN,
      messageKind: 'assistant',
      metadata: {
        kind: 'assistant',
        productCards: [{ productId: 'p1', name: 'Laptop A' }],
      },
    });

    expect(chatModel).toHaveBeenCalledWith(
      expect.objectContaining({
        sender: UserRole.ADMIN,
        messageKind: 'assistant',
        metadata: expect.objectContaining({ kind: 'assistant' }),
      }),
    );
    expect(saved.metadata).toEqual(
      expect.objectContaining({ kind: 'assistant' }),
    );
    expect(supportTicketService.createOrRefreshForChat).not.toHaveBeenCalled();
  });

  it('removes staff-only assistant metadata from customer payloads', () => {
    const { service } = createChatService();

    const message = service.serializeCustomerMessage({
      text: 'Nhân viên tư vấn sẽ hỗ trợ bạn.',
      metadata: {
        kind: 'assistant',
        publicAction: 'handoff_started',
        staffOnly: { internalQueue: 'csr' },
        assistantHandoffSummary: { need: 'Laptop gaming' },
        nested: {
          staffOnly: true,
          publicValue: 'visible',
          assistantHandoffSummary: { need: 'Hidden' },
        },
      },
    } as any);

    expect(message.metadata).toEqual({
      kind: 'assistant',
      publicAction: 'handoff_started',
      nested: { publicValue: 'visible' },
    });
  });
});
