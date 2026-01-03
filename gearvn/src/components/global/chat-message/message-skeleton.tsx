import { Skeleton } from "@/components/ui/skeleton";

export const MessageSkeleton = () => {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start">
          <Skeleton className="size-8 rounded-full flex-shrink-0 bg-gray-300" />
          <div className="flex-1 flex flex-col ml-2 space-y-2">
            <Skeleton className="w-32 h-3 bg-gray-300 rounded" />
            <Skeleton className="w-full h-6 bg-gray-200 rounded-xl" />
            <Skeleton className="w-16 h-2 bg-gray-300 rounded ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
};
