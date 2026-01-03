import Link from "next/link";

import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";

export const NoResults = () => (
  <div
    role="status"
    aria-live="polite"
    className="flex flex-col items-center gap-8 py-16 text-muted-foreground text-center"
  >
    <ShoppingCart strokeWidth={1.5} className="size-16" aria-hidden />
    <p className="text-base">
      Giỏ hàng đang trống. Hãy chọn vài sản phẩm <br /> để bắt đầu mua sắm nhé!
    </p>
    <Button asChild size="xl" className="rounded-sm">
      <Link href="/" title="Tiếp tục mua hàng">
        Tiếp tục mua hàng
      </Link>
    </Button>
  </div>
);
