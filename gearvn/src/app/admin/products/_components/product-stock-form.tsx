"use client";

import { useEffect, useState } from "react";

import { Loader, PackageCheck } from "lucide-react";

import { ProductType } from "@/types/product";
import { parseNumber } from "@/utils/parse-number";
import { formatNumber } from "@/utils/format/format-number";
import { useUpdateProductStock } from "@/react-query/mutation/product";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type ProductStockFormProps = {
  product: ProductType;
  onSuccess?: () => void;
};

export const ProductStockForm = ({ product, onSuccess }: ProductStockFormProps) => {
  const [stock, setStock] = useState(product.stock ?? 0);
  const { mutate: updateProductStock, isPending } = useUpdateProductStock(onSuccess);

  useEffect(() => {
    setStock(product.stock ?? 0);
  }, [product.stock]);

  const handleStockChange = (value: string) => {
    const raw = parseNumber(value);
    if (/^\d*$/.test(raw)) {
      setStock(raw ? parseInt(raw, 10) : 0);
    }
  };

  const handleSubmit = () => {
    updateProductStock({ productId: product._id, stock });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Sản phẩm</p>
          <p className="font-medium">{product.name}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Mã sản phẩm</p>
          <p className="font-mono text-sm">{product._id}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Tồn kho hiện tại</p>
          <p className="font-semibold">{formatNumber(product.stock ?? 0)}</p>
        </div>
      </div>

      <div className="max-w-sm space-y-2">
        <Label htmlFor="stock">Số lượng tồn kho mới</Label>
        <Input
          id="stock"
          type="text"
          inputMode="numeric"
          disabled={isPending}
          value={formatNumber(stock)}
          onChange={(change) => handleStockChange(change.target.value)}
        />
      </div>

      <div className="flex justify-end border-t pt-3">
        <Button type="button" disabled={isPending} onClick={handleSubmit}>
          {isPending ? (
            <Loader className="size-4 animate-spin" />
          ) : (
            <PackageCheck className="size-4" />
          )}
          Cập nhật tồn kho
        </Button>
      </div>
    </div>
  );
};
