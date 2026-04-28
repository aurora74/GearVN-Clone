import type { ReactNode } from "react";
import { AlertTriangle, PackageX } from "lucide-react";

import { DashboardProductMetric, DashboardSummary } from "@/types/dashboard";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProductStockHealthProps = {
  data: DashboardSummary;
};

type ProductListProps = {
  products: DashboardProductMetric[];
  emptyText: string;
  metricLabel: string;
  metricValue: (product: DashboardProductMetric) => string;
  badge?: (product: DashboardProductMetric) => ReactNode;
};

const productKey = (product: DashboardProductMetric) => product._id;

const CompactProductRows = ({
  products,
  emptyText,
  metricLabel,
  metricValue,
  badge,
}: ProductListProps) => {
  if (products.length === 0) {
    return <div className="text-sm text-muted-foreground">{emptyText}</div>;
  }

  return (
    <div className="space-y-2">
      {products.map((product) => (
        <div
          key={productKey(product)}
          className="flex min-h-12 items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
        >
          <div className="min-w-0">
            <div
              className="line-clamp-2 text-sm font-medium"
              title={product.name}
            >
              {product.name}
            </div>
            <div className="text-xs text-muted-foreground">{metricLabel}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {badge?.(product)}
            <span className="text-sm font-semibold tabular-nums">
              {metricValue(product)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

const ProductTable = ({
  products,
  emptyText,
  metricLabel,
  metricValue,
  badge,
}: ProductListProps) => {
  if (products.length === 0) {
    return <div className="text-sm text-muted-foreground">{emptyText}</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sản phẩm</TableHead>
          <TableHead className="w-28 text-right">{metricLabel}</TableHead>
          {badge && <TableHead className="w-28 text-right">Trạng thái</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={productKey(product)}>
            <TableCell className="max-w-[260px] whitespace-normal">
              <div className="line-clamp-2 font-medium" title={product.name}>
                {product.name}
              </div>
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {metricValue(product)}
            </TableCell>
            {badge && (
              <TableCell className="text-right">{badge(product)}</TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const ProductList = (props: ProductListProps) =>
  props.products.length >= 4 ? (
    <ProductTable {...props} />
  ) : (
    <CompactProductRows {...props} />
  );

export const ProductStockHealth = ({ data }: ProductStockHealthProps) => {
  const topSellers = data.productPerformance.topSellers;
  const lowStockProducts = data.stockAlerts.lowStockProducts;
  const outOfStockProducts = data.stockAlerts.outOfStockProducts;

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Hiệu suất sản phẩm</CardTitle>
          <CardDescription>
            Sản phẩm bán chạy theo số lượng đã bán.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductList
            products={topSellers}
            emptyText="Chưa có sản phẩm bán trong kỳ."
            metricLabel="Đã bán"
            metricValue={(product) =>
              `${product.soldQuantity.toLocaleString("vi-VN")}`
            }
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Tồn kho cần xử lý</CardTitle>
                <CardDescription>
                  Hết hàng là khẩn cấp, sắp hết hàng là tồn kho từ 1-5.
                </CardDescription>
              </div>
              {data.stockAlerts.unpublishedLowStockCount > 0 && (
                <Badge
                  variant="outline"
                  className="shrink-0 border-amber-300 text-amber-700"
                >
                  {data.stockAlerts.unpublishedLowStockCount} chưa công khai
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <PackageX className="size-4 text-destructive" />
                Hết hàng
              </div>
              <ProductList
                products={outOfStockProducts}
                emptyText="Không có sản phẩm hết hàng."
                metricLabel="Tồn"
                metricValue={(product) => `${product.stock ?? 0}`}
                badge={() => (
                  <Badge variant="destructive">
                    <PackageX className="size-3" />
                    Hết hàng
                  </Badge>
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="size-4 text-amber-600" />
                Sắp hết hàng
              </div>
              <ProductList
                products={lowStockProducts}
                emptyText="Không có sản phẩm sắp hết hàng."
                metricLabel="Tồn"
                metricValue={(product) => `${product.stock ?? 0}`}
                badge={() => (
                  <Badge
                    variant="outline"
                    className="border-amber-300 text-amber-700"
                  >
                    <AlertTriangle className="size-3" />
                    Sắp hết hàng
                  </Badge>
                )}
              />
            </div>

            {data.stockAlerts.unpublishedLowStockCount > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Có {data.stockAlerts.unpublishedLowStockCount} sản phẩm chưa
                công khai cũng có tồn kho thấp hoặc bằng 0.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
