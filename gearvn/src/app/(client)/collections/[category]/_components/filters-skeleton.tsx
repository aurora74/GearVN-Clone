import { Skeleton } from "@/components/ui/skeleton";

export const FiltersSkeleton = () => (
  <div className="flex flex-col gap-3">
    <Skeleton className="w-full h-10" />
    <div className="flex gap-2 overflow-x-auto">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="w-40 h-10 rounded-sm" />
      ))}
    </div>
  </div>
);
