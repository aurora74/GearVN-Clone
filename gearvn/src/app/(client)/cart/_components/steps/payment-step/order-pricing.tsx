import { formatPrice } from "@/utils/format/format-price";

type OrderPricingProps = {
  subtotal: number;
  productDiscountAmount: number;
  voucherDiscountAmount: number;
  totalPrice: number;
  shippingFee?: number;
};

export const OrderPricing = ({
  subtotal,
  productDiscountAmount,
  voucherDiscountAmount,
  totalPrice,
  shippingFee = 0,
}: OrderPricingProps) => {
  const finalTotal = totalPrice + shippingFee;

  return (
    <section className="border rounded-sm p-4 space-y-2 text-base">
      <div className="flex justify-between">
        <span>Tạm tính:</span>
        <span className="font-medium">{formatPrice(subtotal)}</span>
      </div>

      <div className="flex justify-between text-muted-foreground">
        <span>Giảm giá sản phẩm:</span>
        <span className="font-medium">
          -{formatPrice(productDiscountAmount)}
        </span>
      </div>

      <div className="flex justify-between text-muted-foreground">
        <span>Mã giảm giá:</span>
        <span className="font-medium">
          -{formatPrice(voucherDiscountAmount)}
        </span>
      </div>

      <div className="flex justify-between">
        <span>Phí vận chuyển:</span>
        <span className="font-medium">
          {shippingFee === 0 ? "Miễn phí" : formatPrice(shippingFee)}
        </span>
      </div>

      <hr />

      <div
        aria-label="Tổng cộng"
        className="flex justify-between font-semibold text-lg"
      >
        <span>Tổng cộng:</span>
        <span className="text-primary">{formatPrice(finalTotal)}</span>
      </div>
    </section>
  );
};
