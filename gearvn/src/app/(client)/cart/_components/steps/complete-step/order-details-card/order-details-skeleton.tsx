import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export const OrderDetailsSkeleton = ({ items = 2 }: { items?: number }) => (
  <div className="w-full p-4 sm:p-6 border rounded-md space-y-4 bg-white">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-1/6" />
    </div>

    <Separator />

    <div className="space-y-2 text-sm">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
    </div>

    <Separator />

    <div className="space-y-6">
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[80px_1fr_auto] sm:grid-cols-[96px_1fr_auto] gap-3 sm:gap-4 items-start"
        >
          <Skeleton className="w-20 h-20 sm:w-24 sm:h-24 rounded" />
          <div className="space-y-1 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="flex flex-col space-y-1 min-w-[80px]">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>

    <Separator />

    <div className="space-y-1 text-sm">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-1/4" />
    </div>

    <Separator />

    <Skeleton className="h-6 w-1/4" />
    <Skeleton className="h-4 w-full mt-2" />
  </div>
);
