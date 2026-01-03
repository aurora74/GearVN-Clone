"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ShoppingCart, Trash2 } from "lucide-react";

import { formatPrice } from "@/utils/format/format-price";
import { useCartStore } from "@/stores/use-cart-store";

import { useTotalPrice } from "@/hooks/use-total-price";
import { useTotalQuantity } from "@/hooks/use-total-quantity";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export const CartDropdown = () => {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const { items, justAddedItem, removeItem } = useCartStore();

  const totalPrice = useTotalPrice(items);
  const totalQuantity = useTotalQuantity(items);

  useEffect(() => {
    if (justAddedItem) {
      setIsOpen(true);
      const timeout = setTimeout(() => setIsOpen(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [justAddedItem]);

  const handleCartClick = (e: React.MouseEvent) => {
    if (items.length === 0) {
      e.preventDefault();
      router.push("/cart");
    } else {
      setIsOpen((prev) => !prev);
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <section
          aria-label="Giỏ hàng"
          onClick={handleCartClick}
          className="flex items-center gap-2 relative flex-shrink-0 text-primary-foreground cursor-pointer"
        >
          <div className="relative flex">
            <ShoppingCart aria-hidden="true" className="size-6" />

            {totalQuantity > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#fdd835] text-black text-[10px] font-semibold rounded-full w-4 h-4 flex items-center justify-center">
                {totalQuantity > 9 ? "9+" : totalQuantity}
              </span>
            )}
          </div>

          <p className="sr-only">Xem giỏ hàng</p>
          <p className="hidden xl:block text-sm font-semibold">
            Giỏ <br /> hàng
          </p>
        </section>
      </DropdownMenuTrigger>

      {items.length > 0 && (
        <DropdownMenuContent
          align="start"
          aria-label="Xem trước sản phẩm trong giỏ hàng"
          className="max-w-[380px] sm:max-w-[480px] p-4 rounded-sm"
        >
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-4">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <Image
                    fill
                    src={item.image}
                    alt={`Ảnh sản phẩm ${item.name}`}
                    className="object-cover rounded-sm"
                  />
                </div>

                <div className="flex-1 space-y-1">
                  <h2
                    title={`Sản phẩm: ${item.name}`}
                    className="font-medium text-sm line-clamp-2"
                  >
                    {item.name}
                  </h2>
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <p className="text-primary font-semibold">
                      {formatPrice(item.finalPrice)}
                    </p>
                    <p className="text-muted-foreground">x {item.quantity}</p>
                    {item.discountPercent && item.discountPercent > 0 && (
                      <p className="line-through text-muted-foreground">
                        {formatPrice(item.price)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <button
                    aria-label="Xóa sản phẩm"
                    title="Xóa sản phẩm khỏi giỏ hàng"
                    onClick={() => removeItem(item.id)}
                    className="text-muted-foreground hover:text-destructive cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="text-right">
                    <p className="text-xs font-medium text-muted-foreground">
                      Tạm tính:
                    </p>
                    <p className="text-sm font-bold text-primary">
                      {formatPrice(item.finalPrice * item.quantity)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t gap-3">
              <Button asChild size="sm" className="rounded-sm w-full sm:w-auto">
                <Link href="/cart" title="Xem chi tiết giỏ hàng">
                  Xem giỏ hàng
                </Link>
              </Button>

              <div className="text-right w-full sm:w-auto">
                <p className="text-xs font-medium text-muted-foreground">
                  Tổng:
                </p>
                <p className="text-lg font-bold text-primary">
                  {formatPrice(totalPrice)}
                </p>
              </div>
            </div>
          </div>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
};
