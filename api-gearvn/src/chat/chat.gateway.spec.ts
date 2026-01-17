import { ForbiddenException } from '@nestjs/common';

import { UserRole } from '../auth/enums/user-role.enum';
import { ChatGateway } from './chat.gateway';

const createSocket = (overrides: Partial<any> = {}) => ({
  handshake: { auth: {}, query: {}, headers: {}, ...(overrides.handshake ?? {}) },
  data: overrides.data ?? {},
  join: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  disconnect: jest.fn(),
  ...overrides,
});

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
  };
  const chatAuthService = {
    authenticateSocket: jest.fn(),
  };

  let gateway: ChatGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new ChatGateway(chatService as any, chatAuthService as any);
    gateway.server = server as any;
    chatService.findAllUserIds.mockResolvedValue(['customer-1']);
    chatService.isSupportActor.mockReturnValue(false);
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
    expect(socket.join).toHaveBeenCalledWith('room-client-customer-1');
  });
});
