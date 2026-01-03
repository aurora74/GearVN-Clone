import { TIME_RANGES } from "@/constants/admin/dashboard/dashboard-time-ranges";

import {
  Select,
  SelectItem,
  SelectValue,
  SelectTrigger,
  SelectContent,
} from "@/components/ui/select";

interface ChartTimeRangeSelectorProps {
  value?: string;
  onChange: (v: string) => void;
}

export const ChartTimeRangeSelector = ({
  value,
  onChange,
}: ChartTimeRangeSelectorProps) => {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger
        aria-label="Chọn khoảng thời gian"
        className="flex w-full sm:w-[160px] rounded-lg ml-auto"
      >
        <SelectValue placeholder="Chọn thời gian" />
      </SelectTrigger>

      <SelectContent className="rounded-xl">
        {TIME_RANGES.map((range) => (
          <SelectItem
            key={range.value}
            value={range.value}
            className="rounded-lg"
          >
            {range.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
