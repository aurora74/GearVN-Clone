import * as crypto from 'crypto';

export function buildSecureHash(secret: string, data: Record<string, string>) {
  const signData = new URLSearchParams(data).toString();
  return crypto.createHmac('sha512', secret).update(signData).digest('hex');
}
