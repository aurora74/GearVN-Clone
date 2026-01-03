import Image from "next/image";

import { TrendingUp } from "lucide-react";

import {
  Card,
  CardTitle,
  CardFooter,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { DashboardSummary } from "@/types/dashboard";

type TopProductCardProps = {
  trendDescription: string;
  footerDescription: string;
  product: DashboardSummary["topProduct"];
};

export const TopProductCard = ({
  product,
  trendDescription,
  footerDescription,
}: TopProductCardProps) => (
  <Card className="flex flex-col gap-4">
    <CardHeader>
      <CardDescription>Sản phẩm bán chạy</CardDescription>

      <div className="h-[60px] flex items-center gap-4">
        <div className="relative size-16 flex-shrink-0 bg-muted rounded overflow-hidden">
          {product?.images?.[0] ? (
            <Image
              fill
              alt={product.name}
              src={product.images[0]}
              className="w-full h-full bg-white object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              Không có ảnh sản phẩm
            </span>
          )}
        </div>
        <CardTitle className="text-base font-bold line-clamp-2">
          {product?.name}
        </CardTitle>
      </div>
    </CardHeader>

    <CardFooter className="flex-col items-start gap-1.5 text-sm mt-auto">
      <div className="flex items-center gap-2 font-medium text-primary line-clamp-1">
        {trendDescription} <TrendingUp className="size-4" />
      </div>
      <div className="text-muted-foreground">{footerDescription}</div>
    </CardFooter>
  </Card>
);
