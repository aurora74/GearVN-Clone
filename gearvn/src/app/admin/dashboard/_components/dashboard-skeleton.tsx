import {
  Card,
  CardTitle,
  CardFooter,
  CardHeader,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
        <Skeleton className="w-full sm:w-40 h-8 rounded-lg" />
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <Skeleton className="w-full h-[200px] sm:h-[250px] rounded-lg" />
      </CardContent>
    </Card>
  </>
);
