export type TypingPayload = {
  roomId: string;
  userId?: string;
  from: 'CUSTOMER' | 'ADMIN';
};
