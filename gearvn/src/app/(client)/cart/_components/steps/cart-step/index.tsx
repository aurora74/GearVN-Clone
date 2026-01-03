"use client";

import { formatPrice } from "@/utils/format/format-price";
import { useMe } from "@/react-query/query/user";
import { useTotalPrice } from "@/hooks/use-total-price";

import { useCartStore } from "@/stores/use-cart-store";
import { useAuthModal } from "@/stores/use-auth-modal";
import { useCheckoutStepStore } from "@/stores/use-checkout-step";

import { CartItem } from "./cart-item";
import { NoResults } from "./no-results";

import { Button } from "@/components/ui/button";

export const CartStep = () => {
  const { data: user } = useMe();

  const { setModal } = useAuthModal();
  const { setStep } = useCheckoutStepStore();

  const { items, removeItem, increaseQuantity, decreaseQuantity } =
    useCartStore();

  const isEmpty = items.length === 0;
  const totalPrice = useTotalPrice(items);

  const handleCheckout = () => {
    if (!user) {
      setModal("login");
      return;
    }
    setStep("order-info");
  };

  if (isEmpty) return <NoResults />;

  return (
    <>
      <div className="space-y-6">
        {items.map((item) => (
          <CartItem
            item={item}
            key={item.id}
            removeItem={removeItem}
            increaseQuantity={increaseQuantity}
            decreaseQuantity={decreaseQuantity}
          />
        ))}
      </div>

      <div
        role="region"
        aria-live="polite"
        aria-label="Tổng giá trị giỏ hàng"
        className="pt-6 mt-6 flex justify-between items-center text-xl border-t text-right"
      >
        <p className="font-semibold">Tổng tiền:</p>
        <p id="cart-total" className="font-bold text-primary">
          {formatPrice(totalPrice)}
        </p>
      </div>

      <Button
        type="button"
        onClick={handleCheckout}
        aria-describedby="cart-total"
        aria-label="Tiến hành đặt hàng"
        className="w-full h-12 text-lg rounded-sm mt-4"
      >
        Đặt hàng ngay
      </Button>
    </>
  );
};
