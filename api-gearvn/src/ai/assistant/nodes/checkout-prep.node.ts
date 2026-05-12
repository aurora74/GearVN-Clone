export { VoucherAdapter } from '../adapters/voucher.adapter';

import { VoucherAdapter } from '../adapters/voucher.adapter';
import { AssistantCheckoutFields } from '../adapters/assistant-action.adapter';

interface CheckoutPrepState {
  roomId: string;
  customerId: string;
  subtotal: number;
  selectedVoucherCode?: string;
  action?: 'APPLY_VOUCHER' | 'CHECKOUT_REDIRECT';
  checkout?: AssistantCheckoutFields;
  reviewAccepted?: boolean;
}

const CHECKOUT_REDIRECT_PATH = '/cart?step=payment';

export async function checkoutPrepNode(
  state: CheckoutPrepState,
  adapter: VoucherAdapter,
) {
  const missingFields = getMissingCheckoutFields(state.checkout);
  if (missingFields.length > 0) {
    return {
      type: 'clarification',
      reason: 'missing_checkout_fields',
      missingFields,
    };
  }

  const vouchers = await adapter.listPublic({
    customerId: state.customerId,
    subtotal: state.subtotal,
  });
  const voucher = state.selectedVoucherCode
    ? await adapter.validatePublic({
        code: state.selectedVoucherCode,
        customerId: state.customerId,
        subtotal: state.subtotal,
      })
    : null;

  if (state.selectedVoucherCode && voucher && voucher.valid === false) {
    return {
      type: 'clarification',
      reason: 'invalid_voucher',
      text: 'Mã voucher này có thể chưa dùng được. Kết quả trong chat chỉ mang tính tham khảo; bước thanh toán vẫn kiểm tra lại chính thức.',
      metadata: {
        voucher,
        vouchers,
        advisory: true,
      },
    };
  }

  if (!state.reviewAccepted) {
    return {
      type: 'checkout_review',
      text: 'Bạn kiểm tra lại tên, số điện thoại và địa chỉ giao hàng trước khi mình chuyển sang bước thanh toán nhé.',
      metadata: {
        checkoutReview: {
          name: state.checkout?.name,
          phoneMasked: maskPhone(state.checkout?.phone),
          addressPreview: previewAddress(state.checkout?.address),
          missingFields,
          actions: ['Đúng rồi', 'Chỉnh sửa'],
        },
        voucher,
        vouchers,
        advisory: Boolean(state.selectedVoucherCode),
        voucherAdvisoryText: state.selectedVoucherCode
          ? 'Kết quả kiểm tra voucher trong chat chỉ mang tính tham khảo; bước thanh toán vẫn là nơi xác thực cuối cùng.'
          : undefined,
        redirectPath: CHECKOUT_REDIRECT_PATH,
      },
    };
  }

  const action = state.action === 'APPLY_VOUCHER' ? 'APPLY_VOUCHER' : 'CHECKOUT_REDIRECT';
  const draft = await adapter.createDraft({
    roomId: state.roomId,
    customerId: state.customerId,
    action,
    displayText: action === 'APPLY_VOUCHER' ? 'Áp dụng voucher' : 'Đi tới thanh toán',
    redirectPath: action === 'CHECKOUT_REDIRECT' ? CHECKOUT_REDIRECT_PATH : undefined,
    voucher,
    voucherCode: state.selectedVoucherCode,
    checkout: state.checkout,
    confirmedByBackend: false,
  });

  return {
    type: 'assistant_action_draft',
    draft,
    vouchers,
    metadata: {
      advisory: Boolean(state.selectedVoucherCode),
      voucherAdvisoryText: state.selectedVoucherCode
        ? 'Kết quả kiểm tra voucher trong chat chỉ mang tính tham khảo; bước thanh toán vẫn là nơi xác thực cuối cùng.'
        : undefined,
    },
  };
}

function getMissingCheckoutFields(checkout?: AssistantCheckoutFields): string[] {
  const missing: string[] = [];
  if (!checkout?.name?.trim()) missing.push('name');
  if (!checkout?.phone?.trim()) missing.push('phone');
  if (!checkout?.address?.trim()) missing.push('address');
  return missing;
}

function maskPhone(phone?: string): string | undefined {
  const digits = phone?.replace(/\D/g, '') ?? '';
  if (digits.length < 4) return undefined;
  return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
}

function previewAddress(address?: string): string | undefined {
  const normalized = address?.trim();
  if (!normalized) return undefined;
  if (normalized.length <= 32) return normalized;
  return `${normalized.slice(0, 16)}...${normalized.slice(-10)}`;
}
