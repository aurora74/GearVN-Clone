import {
  Card,
  CardTitle,
  CardFooter,
  CardHeader,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ProductListSkeleton = () => (
  <div className="space-y-2">
    {Array.from({ length: 4 }).map((_, idx) => (
      <div
        key={idx}
        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
      >
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-14" />
      </div>
    ))}
  </div>
);

export const DashboardSkeleton = () => (
  <>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <Card key={idx} className="@container/card flex flex-col gap-4">
          <CardHeader>
            <CardDescription>
              <Skeleton className="w-2/3 sm:w-32 h-4" />
            </CardDescription>
            <CardTitle>
              <Skeleton className="w-1/2 sm:w-24 h-6 mt-2" />
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <Skeleton className="w-3/4 sm:w-40 h-4" />
            <Skeleton className="w-1/2 sm:w-28 h-4" />
          </CardFooter>
        </Card>
      ))}
    </div>

    <Card className="pt-0">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center gap-2 py-5 space-y-0 border-b">
        <div className="grid flex-1 gap-1">
          <CardTitle>
            <Skeleton className="w-2/3 sm:w-40 h-6" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="w-3/4 sm:w-64 h-4 mt-1" />
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <Skeleton className="w-full h-[220px] sm:h-[250px] rounded-lg" />
      </CardContent>
    </Card>

    <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-44" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-64" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductListSkeleton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-40" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-56" />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProductListSkeleton />
          <ProductListSkeleton />
        </CardContent>
      </Card>
    </section>

    <Card>
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-6 w-44" />
        </CardTitle>
        <CardDescription>
          <Skeleton className="h-4 w-72" />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="rounded-md border px-3 py-2 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
        <ProductListSkeleton />
      </CardContent>
    </Card>
  </>
);
