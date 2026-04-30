import { TrendingDown, TrendingUp } from "lucide-react";

import {
  Card,
  CardTitle,
  CardHeader,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const trendColor = {
  up: "text-green-600",
  down: "text-red-600",
};

type StatCardProps = {
  title: string;
  value: string;
  trendValue?: string;
  trend?: "up" | "down";
  trendDescription: string;
  footerDescription: string;
  secondaryDetail?: string;
};

export const StatCard = ({
  title,
  value,
  trend,
  trendValue,
  trendDescription,
  footerDescription,
  secondaryDetail,
}: StatCardProps) => {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;

  return (
    <Card className="min-h-[188px]">
      <CardHeader>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <CardDescription className="line-clamp-1">{title}</CardDescription>
          {TrendIcon && trendValue && (
            <Badge variant="outline" className="flex items-center gap-1">
              <TrendIcon className={`size-4 ${trend === "up" ? trendColor.up : trendColor.down}`} />
              {trendValue}
            </Badge>
          )}
        </div>
        <div className="flex min-h-[60px] items-center">
          <CardTitle className="break-words text-3xl font-bold tabular-nums leading-tight">
            {value}
          </CardTitle>
        </div>
        {secondaryDetail && (
          <div className="line-clamp-2 text-xs text-muted-foreground">
            {secondaryDetail}
          </div>
        )}
      </CardHeader>

      <CardFooter className="mt-auto flex-col items-start gap-1.5 text-sm">
        <div className="flex items-center gap-1 font-medium text-primary line-clamp-1">
          {trendDescription} {TrendIcon && <TrendIcon className="size-4" />}
        </div>
        <div className="text-muted-foreground line-clamp-2">
          {footerDescription}
        </div>
      </CardFooter>
    </Card>
  );
};
