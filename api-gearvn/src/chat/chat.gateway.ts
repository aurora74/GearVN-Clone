import {
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { BadRequestException, Logger } from '@nestjs/common';
import { Socket, Server } from 'socket.io';

import { ChatService } from './chat.service';
import { ChatAuthService } from './chat-auth.service';
import { TypingPayload } from './types/typing-payload';
import { OwnershipActor } from '../auth/policy/ownership';
import { UserRole } from '../auth/enums/user-role.enum';
import { AssistantMode } from '../ai/assistant/assistant.types';
import { AssistantService } from '../ai/assistant/assistant.service';
import { AssistantSessionService } from '../ai/assistant/assistant-session.service';
import {
  AssistantActionAdapter,
  type AssistantProductSnapshot,
} from '../ai/assistant/adapters/assistant-action.adapter';
import { VoucherAdapter } from '../ai/assistant/adapters/voucher.adapter';
const SUPPORT_OPERATORS_ROOM = 'support-operators';
const STAFF_ROOM_SUFFIX = ':staff';
const STAFF_MODE_TEXT = 'Chat với nhân viên tư vấn';
const AI_MODE_TEXT = 'Tiếp tục với AI';
const ASSISTANT_INVOCATION_TIMEOUT_MS = 55_000;

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly chatAuthService: ChatAuthService,
    private readonly assistantService: AssistantService,
    private readonly assistantSessionService: AssistantSessionService,
    private readonly assistantActionAdapter: AssistantActionAdapter,
    private readonly voucherAdapter: VoucherAdapter,
  ) {}

  @WebSocketServer()
  server: Server;

  private onlineUsers = new Map<string, boolean>();
  private assistantInvocationQueues = new Map<string, Promise<void>>();
  private assistantInvocationGenerations = new Map<string, number>();

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

  private getActorId(actor?: OwnershipActor | null) {
    return actor?.id ?? actor?._id?.toString();
  }

  private customerPayload(message: any) {
    return this.chatService.serializeCustomerMessage(message);
  }

  private staffRoom(roomId: string) {
    return `${roomId}${STAFF_ROOM_SUFFIX}`;
  }

  private emitRoomEvent(
    socket: Socket,
    roomId: string,
    event: string,
    payload: any,
  ) {
    socket.emit(event, payload);
    socket.to(roomId).emit(event, payload);
    socket.to(this.staffRoom(roomId)).emit(event, payload);
  }

  private documentId(document: any): string | undefined {
    const id = document?._id;
    return id?.toString?.() ?? (id ? String(id) : undefined);
  }

  private emitMessageToRoom(
    socket: Socket,
    roomId: string,
    message: any,
    event = 'receive-message',
  ) {
    const customerMessage = this.customerPayload(message);
    if (this.chatService.isSupportActor(this.getActor(socket))) {
      socket.emit(event, message);
      this.server.to(roomId).emit(event, customerMessage);
      socket.to(this.staffRoom(roomId)).emit(event, message);
      return;
    }

    socket.to(roomId).emit(event, customerMessage);
    socket.emit(event, customerMessage);
    this.server.to(this.staffRoom(roomId)).emit(event, message);
  }

  private normalizeAttachments(attachments?: string[]) {
    return Array.isArray(attachments) ? attachments : [];
  }

  private assertDraftMatchesPayload(
    draft: any,
    payload: any,
    roomOwnerId: string,
  ) {
    if (!draft)
      throw new BadRequestException('Assistant action draft not found');
    if (String(draft.roomId) !== String(payload.roomId)) {
      throw new BadRequestException('Assistant action draft room mismatch');
    }
    if (String(draft.customerId) !== String(roomOwnerId)) {
      throw new BadRequestException('Assistant action draft owner mismatch');
    }

    const expiresAt = new Date(draft.expiresAt);
    if (
      !draft.expiresAt ||
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt <= new Date()
    ) {
      throw new BadRequestException('Assistant action draft expired');
    }

    const action = draft.action ?? draft.kind ?? draft.payload?.action;
    const expectedProductId =
      draft.product?.id ?? draft.productId ?? draft.payload?.productId;
    const expectedQuantity = draft.quantity ?? draft.payload?.quantity;
    const expectedVoucher =
      draft.voucherCode ?? draft.voucher?.code ?? draft.payload?.voucherCode;
    const expectedCheckout = draft.checkout ?? draft.payload?.checkout;

    if (this.isProductAction(action)) {
      if (!expectedProductId) {
        throw new BadRequestException('Assistant action draft product mismatch');
      }
      if (
        payload.productId !== undefined &&
        String(expectedProductId) !== String(payload.productId)
      ) {
        throw new BadRequestException('Assistant action draft product mismatch');
      }
      if (action !== 'CART_REMOVE') {
        const quantityNumber = Number(expectedQuantity);
        if (!Number.isInteger(quantityNumber) || quantityNumber <= 0) {
          throw new BadRequestException('Assistant action draft quantity mismatch');
        }
      }
      if (
        payload.quantity !== undefined &&
        Number(expectedQuantity) !== Number(payload.quantity)
      ) {
        throw new BadRequestException('Assistant action draft quantity mismatch');
      }
      return;
    }

    if (action === 'APPLY_VOUCHER') {
      if (!expectedVoucher) {
        throw new BadRequestException('Assistant action draft voucher mismatch');
      }
      if (
        payload.voucherCode !== undefined &&
        String(expectedVoucher) !== String(payload.voucherCode)
      ) {
        throw new BadRequestException('Assistant action draft voucher mismatch');
      }
      return;
    }

    if (action === 'CHECKOUT_REDIRECT') {
      if (!this.hasCheckoutFields(expectedCheckout)) {
        throw new BadRequestException('Assistant action draft checkout mismatch');
      }
      if (
        payload.voucherCode !== undefined &&
        expectedVoucher &&
        String(expectedVoucher) !== String(payload.voucherCode)
      ) {
        throw new BadRequestException('Assistant action draft voucher mismatch');
      }
      if (payload.checkout !== undefined) {
        ['name', 'phone', 'address'].forEach((field) => {
          if (
            String(expectedCheckout[field] ?? '') !==
            String(payload.checkout?.[field] ?? '')
          ) {
            throw new BadRequestException(
              'Assistant action draft checkout mismatch',
            );
          }
        });
      }
    }
  }

  private async validateDraftAgainstBackend(
    draft: any,
  ): Promise<{ product?: AssistantProductSnapshot }> {
    if (!this.assistantActionAdapter.confirmActionDraft(draft)) {
      throw new BadRequestException(
        'Assistant action draft failed backend validation',
      );
    }

    const action = draft.action ?? draft.kind ?? draft.payload?.action;
    const productId =
      draft.product?.id ?? draft.productId ?? draft.payload?.productId;
    let confirmedProduct: AssistantProductSnapshot | undefined;
    if (this.isProductAction(action)) {
      const product =
        await this.assistantActionAdapter.findProductSnapshot(productId);
      if (!product)
        throw new BadRequestException(
          'Assistant action product is unavailable',
        );
      if (product.isArchived === true || product.isPublished === false) {
        throw new BadRequestException(
          'Assistant action product is unavailable',
        );
      }
      confirmedProduct = product;
      const quantity = Number(draft.quantity ?? draft.payload?.quantity);
      if (action !== 'CART_REMOVE') {
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new BadRequestException('Assistant action quantity is invalid');
        }
        if (typeof product.stock === 'number' && quantity > product.stock) {
          throw new BadRequestException(
            'Assistant action quantity exceeds stock',
          );
        }
      }
    }

    const voucherCode =
      draft.voucherCode ?? draft.voucher?.code ?? draft.payload?.voucherCode;
    if (voucherCode && action === 'APPLY_VOUCHER') {
      const result = await this.voucherAdapter.validatePublic({
        code: String(voucherCode),
        customerId: draft.customerId,
        subtotal: Number(draft.subtotal ?? draft.product?.price ?? 0),
      });
      if (result?.valid === false) {
        throw new BadRequestException('Assistant action voucher is invalid');
      }
    }

    const checkout = draft.checkout ?? draft.payload?.checkout;
    if (action === 'CHECKOUT_REDIRECT' && !this.hasCheckoutFields(checkout)) {
      throw new BadRequestException(
        'Assistant action checkout fields are incomplete',
      );
    }

    return confirmedProduct ? { product: confirmedProduct } : {};
  }

  private isProductAction(action: string) {
    return (
      action === 'CART_ADD' ||
      action === 'CART_REMOVE' ||
      action === 'CART_SET_QUANTITY'
    );
  }

  private hasCheckoutFields(checkout?: {
    name?: string;
    phone?: string;
    address?: string;
  }) {
    return Boolean(
      checkout?.name?.trim() &&
        checkout?.phone?.trim() &&
        checkout?.address?.trim(),
    );
  }
  private normalizeConfirmedAction(
    draft: any,
    validation: { product?: AssistantProductSnapshot } = {},
  ) {
    const action = draft.action ?? draft.kind;
    const productId =
      draft.product?.id ?? draft.productId ?? draft.payload?.productId;
    const quantity = draft.quantity ?? draft.payload?.quantity;
    const product = validation.product ?? draft.product;
    const confirmed: Record<string, unknown> = {
      draftId: draft.draftId,
      action,
      kind: draft.kind ?? draft.action,
      displayText: draft.displayText,
      productId,
      quantity,
      voucherCode:
        draft.voucherCode ?? draft.voucher?.code ?? draft.payload?.voucherCode,
      checkout: draft.checkout ?? draft.payload?.checkout,
      redirectPath: draft.redirectPath ?? draft.payload?.redirectPath,
      confirmedByBackend: true,
    };

    if (product && this.isProductAction(action)) {
      confirmed.product = this.toConfirmedProductCard(product, productId);
      if (action === 'CART_ADD') {
        confirmed.cartItem = this.toConfirmedCartItem(
          product,
          Number(quantity),
          productId,
        );
      }
    }

    return confirmed;
  }

  private toConfirmedProductCard(
    product: AssistantProductSnapshot,
    fallbackProductId?: string,
  ) {
    const productId = String(product.id ?? fallbackProductId ?? '');
    const stock = typeof product.stock === 'number' ? product.stock : undefined;
    return {
      productId,
      name: product.name,
      slug: product.slug,
      detailHref: product.slug ? `/products/${product.slug}` : `/products/${productId}`,
      price: product.price,
      discountPrice: product.price,
      stock,
      image: '/avatar-default.jpg',
      reasons: ['Backend confirmed product snapshot'],
      availability: {
        status: stock !== undefined && stock <= 0 ? 'out_of_stock' : 'available',
        addable: stock === undefined || stock > 0,
      },
      actionPayload: {
        productId,
        actions: ['CART_ADD'],
      },
      specs: {},
    };
  }

  private toConfirmedCartItem(
    product: AssistantProductSnapshot,
    quantity: number,
    fallbackProductId?: string,
  ) {
    const productId = String(product.id ?? fallbackProductId ?? '');
    const finalPrice = product.price ?? 0;
    return {
      id: productId,
      slug: product.slug ?? productId,
      name: product.name,
      price: product.price ?? finalPrice,
      image: '/avatar-default.jpg',
      quantity,
      finalPrice,
      clientFinalPrice: finalPrice,
    };
  }

  async handleConnection(socket: Socket) {
    try {
      const actor = await this.authenticateSocket(socket);

      if (this.chatService.isSupportActor(actor)) {
        socket.join(SUPPORT_OPERATORS_ROOM);
        const allUsers = await this.chatService.findAllUserIds();
        allUsers.forEach((id: string) =>
          socket.join(this.staffRoom(`room-client-${id}`)),
        );

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
      const roomOwnerId = this.chatService.assertCanAccessChatRoom(
        actor,
        message.roomId,
      );
      const sender = this.chatService.isSupportActor(actor)
        ? UserRole.ADMIN
        : UserRole.CUSTOMER;

      let unreadCount = 1;
      if (sender === UserRole.CUSTOMER) {
        const latestMessage =
          await this.chatService.getLatestMessage(roomOwnerId);
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

      this.emitMessageToRoom(socket, message.roomId, populatedMessage);

      if (sender === UserRole.CUSTOMER) {
        const assistantGeneration =
          (this.assistantInvocationGenerations.get(message.roomId) ?? 0) + 1;
        this.assistantInvocationGenerations.set(message.roomId, assistantGeneration);
        await this.invokeAssistantIfActive({
          socket,
          roomId: message.roomId,
          roomOwnerId,
          text: message.text,
          attachments: message.attachments,
          assistantGeneration,
        });
      }
    } catch (error) {
      this.handleSocketError(socket, error);
    }
  }

  private async invokeAssistantIfActive({
    socket,
    roomId,
    roomOwnerId,
    text,
    attachments,
    assistantGeneration,
  }: {
    socket: Socket;
    roomId: string;
    roomOwnerId: string;
    text: string;
    attachments?: string[];
    assistantGeneration: number;
  }) {
    await this.enqueueAssistantInvocation(roomId, async () => {
      const mode = await this.assistantSessionService.getMode(roomId);
      if (mode === AssistantMode.STAFF) return;

      const result = await this.invokeAssistantSafely({
        roomId,
        roomOwnerId,
        text,
        attachments,
      });

      if (!result.text) return;
      if (
        result.status === 'assistant_unavailable' &&
        this.assistantInvocationGenerations.get(roomId) !== assistantGeneration
      ) {
        return;
      }
      const savedAssistantMessage = await this.chatService.createInternalMessage({
        roomId,
        userId: roomOwnerId,
        sender: UserRole.ADMIN,
        text: result.text,
        messageKind: 'assistant',
        metadata: result.metadata,
      });
      const populatedAssistantMessage = await this.chatService.getMessageWithUser(
        savedAssistantMessage._id,
      );

      this.emitMessageToRoom(socket, roomId, populatedAssistantMessage);
    });
  }

  private async enqueueAssistantInvocation(
    roomId: string,
    task: () => Promise<void>,
  ): Promise<void> {
    const previous = this.assistantInvocationQueues.get(roomId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    const stored = current.then(
      () => undefined,
      () => undefined,
    );
    this.assistantInvocationQueues.set(roomId, stored);

    try {
      await current;
    } finally {
      if (this.assistantInvocationQueues.get(roomId) === stored) {
        this.assistantInvocationQueues.delete(roomId);
      }
    }
  }

  private async invokeAssistantSafely({
    roomId,
    roomOwnerId,
    text,
    attachments,
  }: {
    roomId: string;
    roomOwnerId: string;
    text: string;
    attachments?: string[];
  }) {
    const controller = new AbortController();
    try {
      return await withTimeout(
        this.assistantService.invokeForChatMessage({
          roomId,
          authenticatedUserId: roomOwnerId,
          text,
          attachments: this.normalizeAttachments(attachments),
          signal: controller.signal,
        }),
        ASSISTANT_INVOCATION_TIMEOUT_MS,
        () => controller.abort(),
      );
    } catch (error) {
      this.logger.warn(
        `Assistant invocation failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return {
        status: 'assistant_unavailable',
        text: 'Mình chưa kết nối được dịch vụ AI để xử lý yêu cầu này. Bạn có thể chuyển sang nhân viên tư vấn hoặc thử lại sau khi cấu hình AI hoàn tất.',
        metadata: {
          kind: 'assistant',
          mode: AssistantMode.AI,
          error: {
            code: 'assistant_unavailable',
          },
        },
      };
    }
  }

  @SubscribeMessage('assistant-switch-mode')
  async handleAssistantSwitchMode(
    @MessageBody() payload: { roomId: string; mode: 'ai' | 'staff' },
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const actor = this.getActor(socket);
      const roomOwnerId = this.chatService.assertCanAccessChatRoom(
        actor,
        payload.roomId,
      );
      const nextMode =
        payload.mode === AssistantMode.STAFF
          ? AssistantMode.STAFF
          : AssistantMode.AI;
      const displayText =
        nextMode === AssistantMode.STAFF ? STAFF_MODE_TEXT : AI_MODE_TEXT;

      await this.assistantSessionService.setMode(payload.roomId, nextMode);
      const savedMessage = await this.chatService.create(
        {
          text: displayText,
          roomId: payload.roomId,
          userId: roomOwnerId,
          unreadCount: nextMode === AssistantMode.STAFF ? 1 : 0,
        },
        actor,
      );
      const populatedMessage = await this.chatService.getMessageWithUser(
        savedMessage._id,
      );
      if (nextMode === AssistantMode.STAFF) {
        await this.assistantService.handoffToStaff({
          roomId: payload.roomId,
          authenticatedUserId: roomOwnerId,
          latestMessage: displayText,
          latestMessageId: this.documentId(savedMessage),
        });
      }
      this.emitMessageToRoom(socket, payload.roomId, populatedMessage);

      this.emitRoomEvent(socket, payload.roomId, 'assistant-mode-updated', {
        roomId: payload.roomId,
        mode: nextMode,
      });
    } catch (error) {
      this.handleSocketError(socket, error);
    }
  }

  @SubscribeMessage('assistant-confirm-action')
  async handleAssistantConfirmAction(
    @MessageBody()
    payload: {
      roomId: string;
      draftId: string;
      displayText?: string;
      productId?: string;
      quantity?: number;
      voucherCode?: string;
      checkout?: { name?: string; phone?: string; address?: string };
    },
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const actor = this.getActor(socket);
      const actorId = this.getActorId(actor);
      const roomOwnerId = this.chatService.assertCanAccessChatRoom(
        actor,
        payload.roomId,
      );
      if (!actorId || String(actorId) !== String(roomOwnerId)) {
        throw new BadRequestException(
          'Assistant action confirmation requires room owner',
        );
      }

      const draft = await this.assistantSessionService.findPendingActionDraft(
        payload.roomId,
        payload.draftId,
      );
      this.assertDraftMatchesPayload(draft, payload, roomOwnerId);
      const validation = await this.validateDraftAgainstBackend(draft);

      const consumedDraft =
        await this.assistantSessionService.consumeActionDraft(
          payload.roomId,
          payload.draftId,
        );
      if (!consumedDraft) {
        throw new BadRequestException('Assistant action draft not found');
      }

      const confirmedDraft = consumedDraft as any;
      const confirmed = this.normalizeConfirmedAction(confirmedDraft, validation);
      const savedMessage = await this.chatService.createInternalMessage({
        roomId: payload.roomId,
        userId: roomOwnerId,
        sender: UserRole.ADMIN,
        text: confirmedDraft.displayText,
        messageKind: 'system',
        metadata: {
          kind: 'assistant-action-confirmed',
          confirmed,
        },
      });
      const populatedMessage = await this.chatService.getMessageWithUser(
        savedMessage._id,
      );
      this.emitMessageToRoom(socket, payload.roomId, populatedMessage);

      socket.emit('assistant-action-confirmed', confirmed);
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
      this.chatService.assertCanAccessChatRoom(
        this.getActor(socket),
        payload.roomId,
      );
      const updatedMessage = await this.chatService.editMessage(
        payload.messageId,
        payload.newText,
      );
      if (!updatedMessage) return;
      this.emitMessageToRoom(
        socket,
        payload.roomId,
        updatedMessage,
        'message-edited',
      );
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
      this.chatService.assertCanAccessChatRoom(
        this.getActor(socket),
        payload.roomId,
      );
      const deleted = await this.chatService.deleteMessageById(
        payload.messageId,
      );
      if (!deleted) return;

      this.emitRoomEvent(socket, payload.roomId, 'message-deleted', {
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
      const from = this.chatService.isSupportActor(actor)
        ? UserRole.ADMIN
        : UserRole.CUSTOMER;
      this.emitRoomEvent(socket, payload.roomId, 'typing', {
        ...payload,
        from,
      });
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
      socket.join(
        this.chatService.isSupportActor(actor)
          ? this.staffRoom(roomId)
          : roomId,
      );
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
      this.chatService.assertCanAccessChatRoom(
        this.getActor(socket),
        payload.roomId,
      );
      const updatedMsg = await this.chatService.markAsRead(payload.messageId);
      if (!updatedMsg) return;
      this.emitRoomEvent(socket, payload.roomId, 'message-read', {
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
      const userId = this.chatService.assertCanAccessChatRoom(
        actor,
        payload.roomId,
      );

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
        this.emitRoomEvent(socket, payload.roomId, 'message-read', {
          messageId: id,
          isRead: true,
        }),
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

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      onTimeout?.();
      reject(new Error('assistant_invocation_timeout'));
    }, timeoutMs);
  });

  return Promise.race([
    promise.finally(() => {
      if (timeout) clearTimeout(timeout);
    }),
    timeoutPromise,
  ]);
}
