import {
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';

import { ChatService } from './chat.service';
import { ChatAuthService } from './chat-auth.service';
import { TypingPayload } from './types/typing-payload';
import { OwnershipActor } from '../auth/policy/ownership';
import { UserRole } from '../auth/enums/user-role.enum';

const SUPPORT_OPERATORS_ROOM = 'support-operators';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatAuthService: ChatAuthService,
  ) {}

  @WebSocketServer()
  server: Server;

  private onlineUsers = new Map<string, boolean>();

  private getActor(socket: Socket): OwnershipActor {
    return socket.data.actor;
  }

  private handleSocketError(socket: Socket, error: unknown) {
    socket.emit('chat-error', {
      message: error instanceof Error ? error.message : 'Chat action rejected',
    });
  }

  private async authenticateSocket(socket: Socket) {
    return this.chatAuthService.authenticateSocket(socket);
  }

  async handleConnection(socket: Socket) {
    try {
      const actor = await this.authenticateSocket(socket);

      if (this.chatService.isSupportActor(actor)) {
        socket.join(SUPPORT_OPERATORS_ROOM);
        const allUsers = await this.chatService.findAllUserIds();
        allUsers.forEach((id: string) => socket.join(`room-client-${id}`));

        allUsers.forEach((id: string) => {
          const isOnline = this.onlineUsers.get(id) || false;
          socket.emit('user-online', { userId: id, online: isOnline });
        });
      } else if (actor.role === UserRole.CUSTOMER && actor.id) {
        socket.join(`room-client-${actor.id}`);
        this.onlineUsers.set(actor.id, true);

        this.server.to(SUPPORT_OPERATORS_ROOM).emit('user-online', {
          userId: actor.id,
          online: true,
        });
      }

      socket.on('disconnect', () => {
        if (actor.role === UserRole.CUSTOMER && actor.id) {
          this.onlineUsers.delete(actor.id);
          this.server.to(SUPPORT_OPERATORS_ROOM).emit('user-online', {
            userId: actor.id,
            online: false,
          });
        }
      });
    } catch (error) {
      this.handleSocketError(socket, error);
      socket.disconnect(true);
    }
  }

  @SubscribeMessage('send-message')
  async handleMessage(
    @MessageBody()
    message: {
      sender: 'CUSTOMER' | 'ADMIN';
      text: string;
      roomId: string;
      userId?: string;
      attachments?: string[];
    },
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const actor = this.getActor(socket);
      const roomOwnerId = this.chatService.assertCanAccessChatRoom(actor, message.roomId);
      const sender = this.chatService.isSupportActor(actor)
        ? UserRole.ADMIN
        : UserRole.CUSTOMER;

      let unreadCount = 1;
      if (sender === UserRole.CUSTOMER) {
        const latestMessage = await this.chatService.getLatestMessage(roomOwnerId);
        if (latestMessage) {
          unreadCount = (latestMessage.unreadCount ?? 0) + 1;
        }
      }

      const savedMessage = await this.chatService.create(
        {
          ...message,
          sender,
          userId: roomOwnerId,
          unreadCount: sender === UserRole.CUSTOMER ? unreadCount : 0,
        },
        actor,
      );

      const populatedMessage = await this.chatService.getMessageWithUser(
        savedMessage._id,
      );

      if (sender === UserRole.CUSTOMER) {
        this.server.to(SUPPORT_OPERATORS_ROOM).emit('update-unread-count', {
          userId: roomOwnerId,
          unreadCount,
        });
      }

      this.server.to(message.roomId).emit('receive-message', populatedMessage);
    } catch (error) {
      this.handleSocketError(socket, error);
    }
  }

  @SubscribeMessage('edit-message')
  async handleEditMessage(
    @MessageBody()
    payload: {
      messageId: string;
      roomId: string;
      newText: string;
    },
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      this.chatService.assertCanAccessChatRoom(this.getActor(socket), payload.roomId);
      const updatedMessage = await this.chatService.editMessage(
        payload.messageId,
        payload.newText,
      );
      if (!updatedMessage) return;
      this.server.to(payload.roomId).emit('message-edited', updatedMessage);
    } catch (error) {
      this.handleSocketError(socket, error);
    }
  }

  @SubscribeMessage('delete-message')
  async handleDeleteMessage(
    @MessageBody() payload: { messageId: string; roomId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      this.chatService.assertCanAccessChatRoom(this.getActor(socket), payload.roomId);
      const deleted = await this.chatService.deleteMessageById(payload.messageId);
      if (!deleted) return;

      this.server.to(payload.roomId).emit('message-deleted', {
        messageId: payload.messageId,
        isDeleted: true,
      });
    } catch (error) {
      this.handleSocketError(socket, error);
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() payload: TypingPayload & { typing: boolean },
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const actor = this.getActor(socket);
      this.chatService.assertCanAccessChatRoom(actor, payload.roomId);
      const from = this.chatService.isSupportActor(actor) ? UserRole.ADMIN : UserRole.CUSTOMER;
      this.server.to(payload.roomId).emit('typing', { ...payload, from });
    } catch (error) {
      this.handleSocketError(socket, error);
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const actor = this.getActor(socket);
      this.chatService.assertCanAccessChatRoom(actor, roomId);
      socket.join(roomId);
    } catch (error) {
      this.handleSocketError(socket, error);
    }
  }

  @SubscribeMessage('mark-as-read')
  async handleMarkAsRead(
    @MessageBody() payload: { messageId: string; roomId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      this.chatService.assertCanAccessChatRoom(this.getActor(socket), payload.roomId);
      const updatedMsg = await this.chatService.markAsRead(payload.messageId);
      if (!updatedMsg) return;
      this.server.to(payload.roomId).emit('message-read', {
        messageId: updatedMsg._id.toString(),
        isRead: updatedMsg.isRead,
      });
    } catch (error) {
      this.handleSocketError(socket, error);
    }
  }

  @SubscribeMessage('mark-as-read-bulk')
  async handleMarkAsReadBulk(
    @MessageBody() payload: { messageIds: string[]; roomId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      if (!payload.messageIds || payload.messageIds.length === 0) return;

      const actor = this.getActor(socket);
      const userId = this.chatService.assertCanAccessChatRoom(actor, payload.roomId);

      await this.chatService.markAsReadBulk(payload.messageIds);

      if (this.chatService.isSupportActor(actor)) {
        await this.chatService.resetUnreadCount(userId);
        await this.chatService.markChatProcessing(payload.roomId, actor);
        this.server.to(SUPPORT_OPERATORS_ROOM).emit('update-unread-count', {
          userId,
          unreadCount: 0,
        });
      }

      payload.messageIds.forEach((id) =>
        this.server
          .to(payload.roomId)
          .emit('message-read', { messageId: id, isRead: true }),
      );
    } catch (error) {
      this.handleSocketError(socket, error);
    }
  }

  @SubscribeMessage('check-online')
  handleCheckOnline(
    @MessageBody() userId: string,
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const actor = this.getActor(socket);
      this.chatService.assertCanAccessChatRoom(actor, `room-client-${userId}`);
      const isOnline = this.onlineUsers.get(userId) || false;
      socket.emit('user-online', { userId, online: isOnline });
    } catch (error) {
      this.handleSocketError(socket, error);
    }
  }
}
