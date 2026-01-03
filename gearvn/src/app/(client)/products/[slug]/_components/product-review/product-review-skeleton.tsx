import { Skeleton } from "@/components/ui/skeleton";

export const ProductReviewSkeleton = () => {
  return (
    <div className="w-full space-y-6 p-6 rounded-sm shadow-md bg-white">
      <Skeleton className="h-8 w-1/3 rounded" />

      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded" />
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-6 w-6 rounded" />
          ))}
        </div>
        <Skeleton className="h-6 w-24 rounded" />
      </div>

      {[...Array(2)].map((_, idx) => (
        <div
          key={idx}
          className="flex flex-col sm:flex-row gap-4 border-b border-gray-200 pb-4"
        >
          <div className="flex gap-3 sm:w-[40%] md:w-[30%]">
            <Skeleton className="flex-shrink-0 size-10 rounded-full" />
            <div className="flex flex-col gap-2 w-full">
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-5 w-5 rounded" />
              ))}
            </div>
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-3 w-5/6 rounded" />
            <Skeleton className="h-3 w-1/4 rounded" />
          </div>
        </div>
      ))}

      <div className="flex items-start gap-4 mt-3">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="flex-1 h-32 rounded" />
      </div>

      <div className="flex justify-end">
        <Skeleton className="h-10 w-24 rounded" />
      </div>
    </div>
  );
};
