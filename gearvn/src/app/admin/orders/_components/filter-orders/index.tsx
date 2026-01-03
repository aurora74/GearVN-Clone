"use client";

import { useState, useMemo } from "react";

import { useQueryState } from "nuqs";
import { Funnel, FunnelX } from "lucide-react";

import { ORDER_STATUS_OPTIONS } from "@/constants/admin/orders/order-status-options";
import { PAYMENT_STATUS_OPTIONS } from "@/constants/admin/orders/payment-status-options";
import { PAYMENT_METHOD_OPTIONS } from "@/constants/admin/orders/payment-method-options";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

import { FilterCheckboxGroup } from "./filter-checkbox-group";

const parseArray = (v: string | null) => (v ? v.split(",") : []);
const serializeArray = (v: string[]) => v.join(",");

const parseNumber = (v: string | null) => (v ? Number(v) : null);
const serializeNumber = (v: number | null) => (v != null ? String(v) : "");

const parseDate = (v: string | null) => (v ? new Date(v) : null);
const serializeDate = (v: Date | null) => (v ? v.toISOString() : "");

export const FilterOrders = () => {
  const [isOpen, setIsOpen] = useState(false);

  const [paymentStatus, setPaymentStatus] = useQueryState<string[]>(
    "paymentStatus",
    { history: "push", parse: parseArray, serialize: serializeArray }
  );

  const [paymentMethod, setPaymentMethod] = useQueryState<string[]>(
    "paymentMethod",
    { history: "push", parse: parseArray, serialize: serializeArray }
  );

  const [dateTo, setDateTo] = useQueryState<Date | null>("dateTo", {
    history: "push",
    parse: parseDate,
    serialize: serializeDate,
  });

  const [dateFrom, setDateFrom] = useQueryState<Date | null>("dateFrom", {
    history: "push",
    parse: parseDate,
    serialize: serializeDate,
  });

  const [totalTo, setTotalTo] = useQueryState<number | null>("totalTo", {
    history: "push",
    parse: parseNumber,
    serialize: serializeNumber,
  });

  const [totalFrom, setTotalFrom] = useQueryState<number | null>("totalFrom", {
    history: "push",
    parse: parseNumber,
    serialize: serializeNumber,
  });

  const [orderStatus, setOrderStatus] = useQueryState<string[]>("orderStatus", {
    history: "push",
    parse: parseArray,
    serialize: serializeArray,
  });

  const hasFilter = useMemo(
    () =>
      !!(
        dateFrom ||
        dateTo ||
        totalFrom ||
        totalTo ||
        (orderStatus?.length ?? 0) > 0 ||
        (paymentStatus?.length ?? 0) > 0 ||
        (paymentMethod?.length ?? 0) > 0
      ),
    [
      dateFrom,
      dateTo,
      totalFrom,
      totalTo,
      orderStatus,
      paymentStatus,
      paymentMethod,
    ]
  );

  const resetFilters = () => {
    setDateTo(null);
    setTotalTo(null);
    setDateFrom(null);
    setTotalFrom(null);
    setOrderStatus([]);
    setPaymentStatus([]);
    setPaymentMethod([]);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full sm:w-fit">
          <Funnel /> Bộ lọc
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[calc(100vw-2rem)] sm:w-[650px] max-w-[100vw] max-h-[60vh] sm:max-h-[80vh] p-4 space-y-6 overflow-y-auto"
      >
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex-1 space-y-4">
            <FilterCheckboxGroup
              label="Trạng thái đơn"
              selected={orderStatus ?? []}
              setSelected={setOrderStatus}
              options={ORDER_STATUS_OPTIONS}
            />

            <FilterCheckboxGroup
              label="Trạng thái thanh toán"
              selected={paymentStatus ?? []}
              setSelected={setPaymentStatus}
              options={PAYMENT_STATUS_OPTIONS}
            />

            <FilterCheckboxGroup
              label="Phương thức thanh toán"
              selected={paymentMethod ?? []}
              setSelected={setPaymentMethod}
              options={PAYMENT_METHOD_OPTIONS}
            />

            <div className="space-y-2">
              <Label>Tổng tiền</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Từ"
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    setTotalFrom(value ? Math.max(Number(value), 0) : null);
                  }}
                  value={
                    totalFrom != null ? totalFrom.toLocaleString("vi-VN") : ""
                  }
                  className="flex-1"
                />
                <Input
                  type="text"
                  placeholder="Đến"
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    setTotalTo(value ? Math.max(Number(value), 0) : null);
                  }}
                  value={totalTo != null ? totalTo.toLocaleString("vi-VN") : ""}
                  className="flex-1"
                />
                <span className="text-sm">VNĐ</span>
              </div>
            </div>
          </div>

          <div className="sm:w-fit space-y-2">
            <Label>Chọn ngày tạo</Label>
            {dateFrom && dateTo && (
              <div className="mt-2 text-sm text-gray-600">
                Từ {dateFrom.toLocaleDateString("vi-VN")} đến{" "}
                {dateTo.toLocaleDateString("vi-VN")}
              </div>
            )}

            <Calendar
              mode="range"
              captionLayout="dropdown"
              onSelect={(range) => {
                if (!range) return;
                setDateFrom(range.from ?? null);
                setDateTo(range.to ?? null);
              }}
              selected={
                dateFrom && dateTo ? { from: dateFrom, to: dateTo } : undefined
              }
              className="rounded-md border shadow-sm"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Đóng
          </Button>
          <Button
            variant="destructive"
            disabled={!hasFilter}
            onClick={resetFilters}
            className="flex items-center gap-2"
          >
            <FunnelX className="size-4" /> Xóa tất cả bộ lọc
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
