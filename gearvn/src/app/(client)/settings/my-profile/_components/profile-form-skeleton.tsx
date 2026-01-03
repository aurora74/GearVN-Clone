import { Skeleton } from "@/components/ui/skeleton";

export const ProfileFormSkeleton = () => {
  const renderRows = (count: number) =>
    Array.from({ length: count }).map((_, idx) => (
      <div key={idx} className="grid grid-cols-2 gap-6 mb-6">
        <Skeleton className="w-full h-10 rounded" />
        <Skeleton className="w-full h-10 rounded" />
      </div>
    ));

  return (
    <div className="flex-1 space-y-6 p-4 border bg-white shadow-sm rounded-lg">
      <Skeleton className="w-1/3 h-6 rounded mb-6" />
      {renderRows(4)}
      <div className="flex gap-3 justify-end">
        <Skeleton className="w-32 h-10 rounded" />
        <Skeleton className="w-32 h-10 rounded" />
      </div>
    </div>
  );
};
