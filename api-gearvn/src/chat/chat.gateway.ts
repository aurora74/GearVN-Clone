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
import { TypingPayload } from './types/typing-payload';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection {
  constructor(private readonly chatService: ChatService) {}

  @WebSocketServer()
  server: Server;

  private onlineUsers = new Map<string, boolean>();

  async handleConnection(socket: Socket) {
    const role = socket.handshake.query.role;
    const userId = socket.handshake.query.userId as string;

    if (role === 'ADMIN') {
      socket.join('admins');
      const allUsers = await this.chatService.findAllUserIds();
      allUsers.forEach((id: string) => socket.join(`room-client-${id}`));

      allUsers.forEach((id: string) => {
        const isOnline = this.onlineUsers.get(id) || false;
        socket.emit('user-online', { userId: id, online: isOnline });
      });
    }

    if (role === 'CUSTOMER' && userId) {
      socket.join(`room-client-${userId}`);
      this.onlineUsers.set(userId, true);

      this.server.to('admins').emit('user-online', { userId, online: true });
    }

    socket.on('disconnect', () => {
      if (role === 'CUSTOMER' && userId) {
        this.onlineUsers.delete(userId);
        this.server.to('admins').emit('user-online', { userId, online: false });
      }
    });
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
  ) {
    let unreadCount = 1;
    if (message.userId) {
      const latestMessage = await this.chatService.getLatestMessage(
        message.userId,
      );
      if (latestMessage) {
        unreadCount = (latestMessage.unreadCount ?? 0) + 1;
      }
    }

    const savedMessage = await this.chatService.create({
      ...message,
      unreadCount,
    });

    const populatedMessage = await this.chatService.getMessageWithUser(
      savedMessage._id,
    );

    if (message.sender === 'CUSTOMER' && message.userId) {
      this.server.to('admins').emit('update-unread-count', {
        userId: message.userId,
        unreadCount,
      });
    }

    this.server.to(message.roomId).emit('receive-message', populatedMessage);
  }

  @SubscribeMessage('edit-message')
  async handleEditMessage(
    @MessageBody()
    payload: {
      messageId: string;
      roomId: string;
      newText: string;
    },
  ) {
    const updatedMessage = await this.chatService.editMessage(
      payload.messageId,
      payload.newText,
    );
    if (!updatedMessage) return;
    this.server.to(payload.roomId).emit('message-edited', updatedMessage);
  }

  @SubscribeMessage('delete-message')
  async handleDeleteMessage(
    @MessageBody() payload: { messageId: string; roomId: string },
  ) {
    const deleted = await this.chatService.deleteMessageById(payload.messageId);
    if (!deleted) return;

    this.server.to(payload.roomId).emit('message-deleted', {
      messageId: payload.messageId,
      isDeleted: true,
    });
  }

  @SubscribeMessage('typing')
  handleTyping(@MessageBody() payload: TypingPayload & { typing: boolean }) {
    this.server.to(payload.roomId).emit('typing', payload);
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() socket: Socket,
  ) {
    socket.join(roomId);
  }

  @SubscribeMessage('mark-as-read')
  async handleMarkAsRead(
    @MessageBody() payload: { messageId: string; roomId: string },
  ) {
    const updatedMsg = await this.chatService.markAsRead(payload.messageId);
    if (!updatedMsg) return;
    this.server.to(payload.roomId).emit('message-read', {
      messageId: updatedMsg._id.toString(),
      isRead: updatedMsg.isRead,
    });
  }

  @SubscribeMessage('mark-as-read-bulk')
  async handleMarkAsReadBulk(
    @MessageBody() payload: { messageIds: string[]; roomId: string },
  ) {
    if (!payload.messageIds || payload.messageIds.length === 0) return;

    const userId = payload.roomId.replace('room-client-', '');

    await this.chatService.markAsReadBulk(payload.messageIds);
    await this.chatService.resetUnreadCount(userId);

    this.server.to('admins').emit('update-unread-count', {
      userId,
      unreadCount: 0,
    });

    payload.messageIds.forEach((id) =>
      this.server
        .to(payload.roomId)
        .emit('message-read', { messageId: id, isRead: true }),
    );
  }

  @SubscribeMessage('check-online')
  handleCheckOnline(
    @MessageBody() userId: string,
    @ConnectedSocket() socket: Socket,
  ) {
    const isOnline = this.onlineUsers.get(userId) || false;
    socket.emit('user-online', { userId, online: isOnline });
  }
}
