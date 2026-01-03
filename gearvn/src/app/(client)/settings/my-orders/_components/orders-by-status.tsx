"use client";

import { useEffect, useState } from "react";

import { useQueryState } from "nuqs";
import { Search } from "lucide-react";

import { OrderStatus } from "@/types/order";
import { useDebounce } from "@/hooks/use-debounce";
import { useMyOrders } from "@/react-query/query/order";

import { Input } from "@/components/ui/input";

import { NoResults } from "./no-results";
import { OrderItem } from "./order-item";
import { OrderSkeleton } from "./order-skeleton";

export const OrdersByStatus = ({ status }: { status?: OrderStatus }) => {
  const [search, setSearch] = useQueryState("search", {
    defaultValue: "",
    history: "replace",
  });

  const [inputValue, setInputValue] = useState(search ?? "");
  const debouncedSearch = useDebounce(inputValue, 400);

  const { data: orders, isPending } = useMyOrders({
    search: debouncedSearch || undefined,
    orderStatus: status,
  });

  useEffect(() => {
    if (debouncedSearch !== search) {
      setSearch(debouncedSearch || null);
    }
  }, [debouncedSearch, search, setSearch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setInputValue(e.target.value);

  return (
    <div className="space-y-4">
      <label htmlFor="order-search" className="sr-only">
        Tìm kiếm đơn hàng
      </label>

      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
        <Input
          id="order-search"
          value={inputValue}
          onChange={handleChange}
          placeholder="Nhập mã đơn hàng"
          className="pl-9"
        />
      </div>

      <ul className="space-y-4">
        {isPending ? (
          <OrderSkeleton />
        ) : orders?.data.length === 0 ? (
          <NoResults />
        ) : (
          orders?.data.map((order) => (
            <li key={order._id}>
              <OrderItem order={order} />
            </li>
          ))
        )}
      </ul>
    </div>
  );
};
