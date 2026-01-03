import { Skeleton } from "@/components/ui/skeleton";

export const MessageSkeleton = () => (
  <div className="flex flex-col gap-4 py-3">
    {Array.from({ length: 7 }).map((_, i) => (
      <div key={i} className="flex items-center space-x-3 animate-pulse">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="h-3 w-1/2 rounded" />
        </div>
      </div>
    ))}
  </div>
);
