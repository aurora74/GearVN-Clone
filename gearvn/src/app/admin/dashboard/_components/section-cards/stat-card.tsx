import { TrendingDown, TrendingUp } from "lucide-react";

import {
  Card,
  CardTitle,
  CardAction,
  CardHeader,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type StatCardProps = {
  title: string;
  value: string;
  trendValue?: string;
  trend?: "up" | "down";
  trendDescription: string;
  footerDescription: string;
};

export const StatCard = ({
  title,
  value,
  trend,
  trendValue,
  trendDescription,
  footerDescription,
}: StatCardProps) => {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>{title}</CardDescription>
          {TrendIcon && (
            <Badge variant="outline" className="flex items-center gap-1">
              <TrendIcon
                className={`size-4 ${
                  trend === "up" ? "text-green-600" : "text-red-600"
                }`}
              />
              {trendValue}
            </Badge>
          )}
        </div>
        <div className="h-[60px] flex items-center">
          <CardTitle className="text-3xl font-bold tabular-nums">
            {value}
          </CardTitle>
        </div>
      </CardHeader>

      <CardFooter className="flex-col items-start gap-1.5 text-sm mt-auto">
        <div className="flex items-center gap-1 font-medium text-primary line-clamp-1">
          {trendDescription} {TrendIcon && <TrendIcon className="size-4" />}
        </div>
        <div className="text-muted-foreground">{footerDescription}</div>
      </CardFooter>
    </Card>
  );
};
