"use client";

import { useMemo } from "react";

import { useQueryState } from "nuqs";

import { useOrders } from "@/react-query/query/order";

import { columns } from "./columns";
import { DataTable } from "./data-table";

export const OrdersPage = () => {
  const [search] = useQueryState("search");
  const [sortBy] = useQueryState("sortBy");
  const [dateTo] = useQueryState("dateTo");
  const [dateFrom] = useQueryState("dateFrom");
  const [orderStatus] = useQueryState("orderStatus");
  const [paymentStatus] = useQueryState("paymentStatus");
  const [paymentMethod] = useQueryState("paymentMethod");
  const [totalTo] = useQueryState("totalTo", { parse: Number });
  const [totalFrom] = useQueryState("totalFrom", { parse: Number });
  const [page] = useQueryState("page", { parse: Number, serialize: String });

  const queryParams = useMemo(
    () => ({
      page: (page ?? 0) + 1,
      limit: 20,
      sortBy: sortBy || "-createdAt",
      ...(search && { search }),
      ...(dateTo && { dateTo }),
      ...(dateFrom && { dateFrom }),
      ...(totalTo != null && { totalTo }),
      ...(orderStatus && { orderStatus }),
      ...(paymentStatus && { paymentStatus }),
      ...(paymentMethod && { paymentMethod }),
      ...(totalFrom != null && { totalFrom }),
    }),
    [
      page,
      sortBy,
      search,
      dateTo,
      totalTo,
      dateFrom,
      totalFrom,
      orderStatus,
      paymentStatus,
      paymentMethod,
    ]
  );

  const { data: orders, isPending } = useOrders(queryParams);

  const tableData = orders?.data ?? [];
  const totalItems = orders?.total ?? 0;
  const pageCount = orders?.totalPages ?? 0;

  return (
    <div className="h-full p-4 space-y-4 border bg-white shadow-sm rounded-md">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">Danh sách đơn hàng</h1>
        <p className="text-sm text-muted-foreground">({totalItems} đơn hàng)</p>
      </div>
      <DataTable
        data={tableData}
        columns={columns}
        isPending={isPending}
        pageCount={pageCount}
      />
    </div>
  );
};
