import { ShoppingBag } from "lucide-react";

export const NoResults = () => (
  <section className="text-center py-12" aria-label="Chưa có đơn hàng">
    <ShoppingBag
      className="size-12 text-gray-400 mb-4 mx-auto"
      strokeWidth={1}
    />
    <h2 className="text-lg font-semibold text-gray-900 mb-2">
      Chưa có đơn hàng nào
    </h2>
    <p className="text-sm text-muted-foreground">
      Khi bạn đặt đơn hàng đầu tiên, nó sẽ hiển thị tại đây.
    </p>
  </section>
);
