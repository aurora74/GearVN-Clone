"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import {
  DashboardSummaryParams,
  DashboardSummaryPreset,
} from "@/types/dashboard";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type DashboardFilterBarProps = {
  value: DashboardSummaryParams;
  onChange: (params: DashboardSummaryParams) => void;
};

const PRESETS: Array<{
  label: string;
  value: Exclude<DashboardSummaryPreset, "custom">;
}> = [
  { label: "7 ngày", value: "7d" },
  { label: "30 ngày gần đây", value: "30d" },
  { label: "90 ngày", value: "90d" },
];

const toStartOfDayIso = (date: Date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value.toISOString();
};

const toEndOfDayIso = (date: Date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value.toISOString();
};

const formatDate = (date?: Date) =>
  date
    ? date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";

export const DashboardFilterBar = ({
  value,
  onChange,
}: DashboardFilterBarProps) => {
  const [range, setRange] = useState<DateRange | undefined>(() => ({
    from: value.startDate ? new Date(value.startDate) : undefined,
    to: value.endDate ? new Date(value.endDate) : undefined,
  }));
  const [open, setOpen] = useState(false);

  const selectedPreset = value.preset ?? "30d";
  const customLabel =
    value.preset === "custom" && value.startDate && value.endDate
      ? `${formatDate(new Date(value.startDate))} - ${formatDate(
          new Date(value.endDate)
        )}`
      : "Tùy chọn ngày";

  const applyCustomRange = () => {
    if (!range?.from || !range?.to) return;

    onChange({
      preset: "custom",
      startDate: toStartOfDayIso(range.from),
      endDate: toEndOfDayIso(range.to),
    });
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm font-medium text-muted-foreground">
        Khoảng thời gian
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
        {PRESETS.map((preset) => (
          <Button
            key={preset.value}
            type="button"
            size="sm"
            variant={selectedPreset === preset.value ? "default" : "outline"}
            className="min-w-0 px-3"
            onClick={() => onChange({ preset: preset.value })}
          >
            {preset.label}
          </Button>
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant={selectedPreset === "custom" ? "default" : "outline"}
              className={cn(
                "col-span-2 min-w-0 justify-center px-3 sm:col-span-1",
                selectedPreset === "custom" && "text-primary-foreground"
              )}
            >
              <CalendarIcon className="size-4" />
              <span className="truncate">{customLabel}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="end">
            <div className="space-y-3">
              <Calendar
                mode="range"
                captionLayout="dropdown"
                selected={range}
                onSelect={setRange}
                className="rounded-md border shadow-sm"
              />
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={!range?.from || !range?.to}
                onClick={applyCustomRange}
              >
                Áp dụng bộ lọc
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
