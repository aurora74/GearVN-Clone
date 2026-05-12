import { randomUUID } from 'crypto';
import { Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Product, ProductDocument } from '../../../product/product.schema';
import { ProductService } from '../../../product/product.service';
import { AssistantSessionService } from '../assistant-session.service';

export type AssistantCartAction =
  | 'CART_ADD'
  | 'CART_REMOVE'
  | 'CART_SET_QUANTITY';

export type AssistantCheckoutAction = 'APPLY_VOUCHER' | 'CHECKOUT_REDIRECT';

export type AssistantActionType = AssistantCartAction | AssistantCheckoutAction;

export interface AssistantProductSnapshot {
  id: string;
  slug?: string;
  name: string;
  price?: number;
  stock?: number;
  isPublished?: boolean;
  isArchived?: boolean;
}

export interface AssistantActionDraftInput {
  roomId: string;
  customerId: string;
  action: AssistantActionType;
  displayText: string;
  product?: AssistantProductSnapshot;
  productId?: string;
  quantity?: number;
  voucher?: Record<string, unknown> | null;
  voucherCode?: string;
  checkout?: AssistantCheckoutFields;
  redirectPath?: string;
  confirmedByBackend: false;
}

export interface AssistantActionDraft extends AssistantActionDraftInput {
  draftId: string;
  kind: AssistantActionType;
  status: 'pending' | 'confirmed';
  requiresConfirmation: true;
  expiresAt: Date;
  payload: Record<string, unknown>;
}

export interface AssistantCheckoutFields {
  name?: string;
  phone?: string;
  address?: string;
}

@Injectable()
export class AssistantActionAdapter {
  constructor(
    @Optional() private readonly productService?: ProductService,
    @Optional() private readonly sessionService?: AssistantSessionService,
    @Optional()
    @InjectModel(Product.name)
    private readonly productModel?: Model<ProductDocument>,
  ) {}

  async findProductSnapshot(
    productId: string,
  ): Promise<AssistantProductSnapshot | null> {
    if (!productId) return null;

    const product = this.productService
      ? ((await callMaybe(this.productService, 'findOne', productId)) ??
        (await callMaybe(this.productService, 'findById', productId)))
      : await this.findProductByModel(productId);
    if (!product) return null;

    return normalizeProductSnapshot(product);
  }

  async createDraft(
    draft: AssistantActionDraftInput,
  ): Promise<AssistantActionDraft> {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const normalized: AssistantActionDraft = {
      ...draft,
      draftId: `draft-${randomUUID()}`,
      kind: draft.action,
      status: 'pending',
      requiresConfirmation: true,
      expiresAt,
      payload: normalizeDraftPayload(draft),
    };

    if (this.sessionService) {
      await this.sessionService.saveActionDraft(draft.roomId, normalized as any);
    }

    return normalized;
  }

  validateConfirmedAction(draft: AssistantActionDraft): boolean {
    return validateDraftShape(draft);
  }

  confirmActionDraft(draft: AssistantActionDraft): boolean {
    return this.validateConfirmedAction(draft);
  }

  async mutateCart(): Promise<never> {
    throw new Error('Assistant cart mutation requires backend confirmation');
  }

  async confirmAction(): Promise<never> {
    throw new Error('Use AssistantActionConfirmationService for confirmations');
  }

  async createOrder(): Promise<never> {
    throw new Error('Assistant never creates orders directly');
  }

  async createPayment(): Promise<never> {
    throw new Error('Assistant never creates payments directly');
  }

  async decrementInventory(): Promise<never> {
    throw new Error('Assistant never mutates inventory directly');
  }

  async reserveVoucher(): Promise<never> {
    throw new Error('Assistant never reserves vouchers before checkout');
  }
  private async findProductByModel(productId: string) {
    if (!this.productModel) return null;
    try {
      return this.productModel.findById(productId).lean().exec();
    } catch {
      return null;
    }
  }
}

function normalizeDraftPayload(
  draft: AssistantActionDraftInput,
): Record<string, unknown> {
  return {
    action: draft.action,
    productId: draft.product?.id ?? draft.productId,
    quantity: draft.quantity,
    voucherCode: draft.voucherCode ?? draft.voucher?.code,
    checkout: draft.checkout,
    redirectPath: draft.redirectPath,
  };
}

function validateDraftShape(draft: AssistantActionDraft): boolean {
  if (!draft.draftId || !draft.roomId || !draft.customerId) return false;
  if (!draft.requiresConfirmation || draft.status !== 'pending') return false;
  const expiresAt = new Date(draft.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    return false;
  }
  if (draft.action === 'CHECKOUT_REDIRECT') {
    return hasCheckoutFields(draft.checkout) && draft.redirectPath === '/cart?step=payment';
  }
  if (draft.action === 'APPLY_VOUCHER') return Boolean(draft.voucherCode);
  return Boolean(draft.product?.id ?? draft.productId) && Number.isFinite(draft.quantity);
}

function hasCheckoutFields(checkout?: AssistantCheckoutFields): boolean {
  return Boolean(
    checkout?.name?.trim() && checkout?.phone?.trim() && checkout?.address?.trim(),
  );
}

function normalizeProductSnapshot(product: any): AssistantProductSnapshot {
  const base = typeof product?.toObject === 'function' ? product.toObject() : product;
  return {
    id: String(base?._id ?? base?.id),
    slug: base?.slug,
    name: String(base?.name ?? ''),
    price: Number(base?.price ?? base?.discountPrice ?? 0),
    stock: Number(base?.stock ?? 0),
    isPublished: base?.isPublished,
    isArchived: base?.isArchived,
  };
}

async function callMaybe(target: any, method: string, ...args: unknown[]) {
  if (typeof target?.[method] !== 'function') return null;
  try {
    return await target[method](...args);
  } catch {
    return null;
  }
}
