import Link from "next/link";
import Image from "next/image";

import { Minus, Plus, Trash2 } from "lucide-react";

import { formatPrice } from "@/utils/format/format-price";
import { CartItemType } from "@/types/order";

import { Button } from "@/components/ui/button";
import { toastSuccess } from "@/components/ui/toaster";

type CartItemProps = {
  item: CartItemType;
  removeItem: (id: string) => void;
  increaseQuantity: (id: string) => void;
  decreaseQuantity: (id: string) => void;
};

export const CartItem = ({
  item,
  removeItem,
  increaseQuantity,
  decreaseQuantity,
}: CartItemProps) => {
  const handleRemove = () => {
    removeItem(item.id);
    toastSuccess("Đã xóa sản phẩm khỏi giỏ hàng", item.name);
  };

  return (
    <div
      aria-label={`Sản phẩm trong giỏ: ${item.name}`}
      className="grid grid-cols-1 sm:grid-cols-[120px_1fr_auto] items-start gap-4 py-4"
    >
      <div className="w-full sm:w-32 h-32 sm:h-32 mx-auto relative rounded overflow-hidden cursor-pointer">
        <Image
          src={item.image}
          alt={item.name}
          title={item.name}
          fill
          className="object-contain"
        />
      </div>

      <div className="flex flex-col justify-between">
        <div className="space-y-1">
          <Link
            href={`/products/${item.slug}`}
            title={`Xem chi tiết sản phẩm ${item.name}`}
            aria-label={`Xem chi tiết sản phẩm ${item.name}`}
            className="font-semibold text-base hover:text-primary leading-tight line-clamp-2"
          >
            {item.name}
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-primary">
              {formatPrice(item.finalPrice)}
            </p>

            <p className="text-sm">× {item.quantity}</p>

            {item.discountPercent && item.discountPercent > 0 && (
              <p className="line-through text-sm text-muted-foreground">
                {formatPrice(item.price)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Button
            size="icon"
            variant="outline"
            disabled={item.quantity <= 1}
            onClick={() => decreaseQuantity(item.id)}
            aria-label={`Giảm số lượng sản phẩm ${item.name} xuống 1`}
            title={
              item.quantity <= 1 ? "Số lượng tối thiểu là 1" : "Giảm số lượng"
            }
          >
            <Minus className="w-4 h-4" />
          </Button>

          <span className="min-w-[24px] text-center">{item.quantity}</span>

          <Button
            size="icon"
            variant="outline"
            title="Tăng số lượng"
            onClick={() => increaseQuantity(item.id)}
            aria-label={`Tăng số lượng sản phẩm ${item.name} lên 1`}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="min-w-[100px] flex flex-col justify-between items-end text-right mt-2 sm:mt-0">
        <p className="text-lg font-semibold text-primary">
          {formatPrice(item.finalPrice * item.quantity)}
        </p>

        <button
          title="Xóa sản phẩm"
          onClick={handleRemove}
          aria-label="Xóa sản phẩm"
          className="text-muted-foreground hover:text-destructive mt-2 cursor-pointer disabled:opacity-50"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
};
