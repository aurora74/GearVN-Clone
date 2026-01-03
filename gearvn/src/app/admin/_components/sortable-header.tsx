import { useCallback, useMemo } from "react";

import { useQueryState } from "nuqs";
import { ArrowUp, ArrowDown } from "lucide-react";

import { Hint } from "@/components/global/hint";

type SortableHeaderProps = {
  label: string;
  sortKey: string;
};

export const SortableHeader = ({ label, sortKey }: SortableHeaderProps) => {
  const [sortBy, setSortBy] = useQueryState("sortBy");

  const isAsc = sortBy === sortKey;
  const isDesc = sortBy === `-${sortKey}`;

  const toggleSort = useCallback(() => {
    if (!sortBy || sortBy !== sortKey) return setSortBy(sortKey);
    if (isAsc) return setSortBy(`-${sortKey}`);
    if (isDesc) return setSortBy("");
  }, [sortBy, sortKey, isAsc, isDesc, setSortBy]);

  const SortIcon = useMemo(() => {
    if (isAsc) return <ArrowUp className="size-3 text-muted-foreground" />;
    if (isDesc) return <ArrowDown className="size-3 text-muted-foreground" />;
    return null;
  }, [isAsc, isDesc]);

  return (
    <Hint label="Sắp xếp theo thứ tự tăng/giảm">
      <div
        onClick={toggleSort}
        className="flex items-center gap-1 font-medium cursor-pointer select-none"
      >
        {label}
        {SortIcon}
      </div>
    </Hint>
  );
};
