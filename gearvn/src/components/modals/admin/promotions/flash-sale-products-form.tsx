"use client";

import { useEffect, useMemo, useState } from "react";

import { AlertTriangle, Check, Loader, Search, X } from "lucide-react";

import { useUpdateProduct } from "@/react-query/mutation/product";
import { useProducts } from "@/react-query/query/product";
import { EventType } from "@/types/event";
import { ProductType } from "@/types/product";
import { formatPrice } from "@/utils/format/format-price";
import { toastSuccess } from "@/components/ui/toaster";
import { cn } from "@/utils/cn";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FlashSaleProductsFormProps = {
  event: EventType;
  children: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
};

const toProductPayload = (
  product: ProductType,
  patch: Pick<ProductType, "event"> & {
    discountPrice?: number | null;
    discountPercent?: number | null;
  }
) => ({
  id: product._id,
  name: product.name,
  slug: product.slug,
  price: product.price,
  category: product.category,
  description: product.description,
  images: product.images,
  attributes: product.attributes ?? {},
  ...patch,
});

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const formatDiscountPercent = (value: number) => {
  const rounded = Number(value.toFixed(2));
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toString().replace(/\.0+$/, "");
};

const calculateSalePrice = (price: number, discountPercent: number) =>
  Math.round(price * (1 - discountPercent / 100));

const calculateDiscountPercent = (price: number, salePrice: number) => {
  if (price <= 0) return 0;
  return clampNumber(((price - salePrice) / price) * 100, 0, 100);
};

const getAppliedSalePrice = (product: ProductType) =>
  product.discountPrice && product.discountPrice > 0
    ? product.discountPrice
    : product.price;

const getAppliedDiscountPercent = (product: ProductType) => {
  if (product.discountPercent && product.discountPercent > 0) {
    return product.discountPercent;
  }

  return calculateDiscountPercent(product.price, getAppliedSalePrice(product));
};

export const FlashSaleProductsForm = ({
  event,
  children,
  onOpenChange,
}: FlashSaleProductsFormProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [pendingDetachId, setPendingDetachId] = useState<string | null>(null);

  const { data: products, isPending: isLoadingProducts } = useProducts({
    page: 1,
    limit: 20,
    search: search || undefined,
  });
  const { data: attachedProductsData, isPending: isLoadingAttached } = useProducts({
    page: 1,
    limit: 50,
    event: event.tag,
  });
  const { mutate: updateProduct, isPending: isUpdating } = useUpdateProduct(() => {
    toastSuccess("Đã lưu khuyến mãi", "Sản phẩm flash sale đã được cập nhật.");
    setSelectedProductId("");
    setDiscountPrice("");
    setDiscountPercent("");
    setPendingDetachId(null);
  });

  const productList = useMemo(() => products?.data ?? [], [products?.data]);
  const attachedProducts = useMemo(
    () => attachedProductsData?.data ?? [],
    [attachedProductsData?.data]
  );
  const attachedProductIds = useMemo(
    () => new Set(attachedProducts.map((product) => product._id)),
    [attachedProducts]
  );
  const selectedProduct =
    productList.find((product) => product._id === selectedProductId) ??
    attachedProducts.find((product) => product._id === selectedProductId);

  const selectedProductEvent = selectedProduct?.event?.trim() ?? "";
  const selectedProductAttachedElsewhere = Boolean(
    selectedProductEvent && selectedProductEvent !== event.tag
  );
  const selectedSalePrice = discountPrice ? Number(discountPrice) : null;
  const selectedDiscountPercent = discountPercent ? Number(discountPercent) : null;
  const hasValidSaleValue = Boolean(
    selectedProduct &&
      selectedSalePrice &&
      selectedSalePrice > 0 &&
      selectedSalePrice < selectedProduct.price &&
      selectedDiscountPercent &&
      selectedDiscountPercent > 0 &&
      selectedDiscountPercent <= 100
  );

  useEffect(() => {
    if (!selectedProduct) {
      setDiscountPrice("");
      setDiscountPercent("");
      return;
    }

    if (selectedProduct.event === event.tag) {
      const salePrice = getAppliedSalePrice(selectedProduct);
      const percent = getAppliedDiscountPercent(selectedProduct);
      setDiscountPrice(salePrice > 0 ? String(salePrice) : "");
      setDiscountPercent(percent > 0 ? formatDiscountPercent(percent) : "");
      return;
    }

    setDiscountPrice("");
    setDiscountPercent("");
  }, [event.tag, selectedProduct]);

  const handleDiscountPercentChange = (value: string) => {
    setDiscountPercent(value);

    if (!selectedProduct || value === "") {
      setDiscountPrice("");
      return;
    }

    const parsedPercent = Number(value);
    if (!Number.isFinite(parsedPercent)) return;

    const boundedPercent = clampNumber(parsedPercent, 0, 100);
    if (boundedPercent !== parsedPercent) {
      setDiscountPercent(formatDiscountPercent(boundedPercent));
    }

    setDiscountPrice(String(calculateSalePrice(selectedProduct.price, boundedPercent)));
  };

  const handleDiscountPriceChange = (value: string) => {
    setDiscountPrice(value);

    if (!selectedProduct || value === "") {
      setDiscountPercent("");
      return;
    }

    const parsedPrice = Number(value);
    if (!Number.isFinite(parsedPrice)) return;

    const boundedPrice = Math.round(
      clampNumber(parsedPrice, 0, selectedProduct.price)
    );
    if (boundedPrice !== parsedPrice) {
      setDiscountPrice(String(boundedPrice));
    }

    setDiscountPercent(
      formatDiscountPercent(calculateDiscountPercent(selectedProduct.price, boundedPrice))
    );
  };

  const handleAttach = () => {
    if (!selectedProduct || selectedProductAttachedElsewhere || !hasValidSaleValue) return;

    updateProduct(
      toProductPayload(selectedProduct, {
        event: event.tag,
        discountPrice: Math.round(Number(discountPrice)),
        discountPercent: Number(Number(discountPercent).toFixed(2)),
      })
    );
  };

  const requestDetach = (product: ProductType) => {
    setPendingDetachId(product._id);
  };

  const confirmDetach = (product: ProductType) => {
    updateProduct(
      toProductPayload(product, {
        event: "",
        discountPrice: 0,
        discountPercent: 0,
      })
    );
  };

  const handleDialogChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setSelectedProductId("");
      setDiscountPrice("");
      setDiscountPercent("");
      setPendingDetachId(null);
    }

    onOpenChange?.(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto custom-scroll sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Sản phẩm flash sale</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_160px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                disabled={isUpdating}
                placeholder="Tìm sản phẩm"
                className="pl-9"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Input
              value={discountPrice}
              type="number"
              min={0}
              max={selectedProduct?.price}
              disabled={isUpdating || !selectedProduct || selectedProductAttachedElsewhere}
              placeholder="Giá flash sale"
              onChange={(event) => handleDiscountPriceChange(event.target.value)}
            />
            <Input
              value={discountPercent}
              type="number"
              min={0}
              max={100}
              disabled={isUpdating || !selectedProduct || selectedProductAttachedElsewhere}
              placeholder="Phần trăm giảm"
              onChange={(event) => handleDiscountPercentChange(event.target.value)}
            />
          </div>

          {selectedProduct ? (
            <div
              className={cn(
                "rounded-md border p-3 text-sm",
                selectedProductAttachedElsewhere
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-primary/40 bg-primary/5"
              )}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div
                    className={cn(
                      "flex items-center gap-2 font-semibold",
                      selectedProductAttachedElsewhere ? "text-destructive" : "text-primary"
                    )}
                  >
                    {selectedProductAttachedElsewhere ? (
                      <AlertTriangle className="size-4 shrink-0" />
                    ) : (
                      <Check className="size-4 shrink-0" />
                    )}
                    <span className="line-clamp-1">{selectedProduct.name}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                    <span>Giá gốc: {formatPrice(selectedProduct.price)}</span>
                    <span>stock: {selectedProduct.stock}</span>
                    {attachedProductIds.has(selectedProduct._id) && (
                      <span>Đã gắn với flash sale này</span>
                    )}
                  </div>
                  {selectedProductAttachedElsewhere && (
                    <p className="mt-2 text-destructive">
                      Sản phẩm đang gắn với {selectedProductEvent}. Hãy gỡ khỏi sự kiện đó trước khi gắn vào {event.tag}.
                    </p>
                  )}
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[390px]">
                  <div className="rounded-md border bg-background px-3 py-2">
                    <span className="block text-xs text-muted-foreground">Giá flash sale</span>
                    <span className="font-semibold">
                      {selectedSalePrice ? formatPrice(selectedSalePrice) : "Chưa nhập"}
                    </span>
                  </div>
                  <div className="rounded-md border bg-background px-3 py-2">
                    <span className="block text-xs text-muted-foreground">Giảm</span>
                    <span className="font-semibold">
                      {selectedDiscountPercent ? `${formatDiscountPercent(selectedDiscountPercent)}%` : "Chưa nhập"}
                    </span>
                  </div>
                  <div className="rounded-md border bg-background px-3 py-2">
                    <span className="block text-xs text-muted-foreground">Sau khi gắn</span>
                    <span className="font-semibold text-primary">
                      {hasValidSaleValue ? formatPrice(selectedSalePrice ?? 0) : "Cần giá giảm"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
              Chưa chọn sản phẩm
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Danh sách sản phẩm</span>
              <span className="text-muted-foreground">{productList.length} kết quả</span>
            </div>
            <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 custom-scroll">
              {productList.map((product) => {
                const isSelected = selectedProductId === product._id;
                const isAttached = attachedProductIds.has(product._id);
                const isAttachedElsewhere = Boolean(
                  product.event && product.event !== event.tag
                );

                return (
                  <button
                    key={product._id}
                    type="button"
                    disabled={isUpdating || isAttachedElsewhere}
                    onClick={() => setSelectedProductId(product._id)}
                    className={cn(
                      "grid gap-2 rounded-md border p-3 text-left text-sm transition hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-60 sm:grid-cols-[minmax(0,1fr)_120px_100px_150px]",
                      isSelected && "border-primary bg-primary/5 ring-1 ring-primary/30",
                      isAttached && !isSelected && "bg-muted/40",
                      isAttachedElsewhere && "border-destructive/20 bg-destructive/5"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2 font-semibold">
                      {isSelected && <Check className="size-4 shrink-0 text-primary" />}
                      <span className="line-clamp-1">{product.name}</span>
                    </span>
                    <span>{formatPrice(product.price)}</span>
                    <span>stock: {product.stock}</span>
                    <span
                      className={cn(
                        "text-muted-foreground",
                        isAttached && "text-primary",
                        isAttachedElsewhere && "text-destructive"
                      )}
                    >
                      {isAttached
                        ? "Đã gắn"
                        : isAttachedElsewhere
                          ? `Đã gắn: ${product.event}`
                          : "Chưa gắn"}
                    </span>
                  </button>
                );
              })}
              {isLoadingProducts && (
                <div className="flex items-center justify-center gap-2 rounded-md border p-4 text-sm text-muted-foreground">
                  <Loader className="size-4 animate-spin" />
                  Đang tải sản phẩm...
                </div>
              )}
            </div>
          </div>

          <div className="rounded-md border">
            <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
              <span className="font-semibold">Đang gắn với {event.tag}</span>
              <span className="text-muted-foreground">{attachedProducts.length} sản phẩm</span>
            </div>
            <div className="hidden border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_120px_130px_90px_80px_40px] sm:gap-2">
              <span>Sản phẩm</span>
              <span>Giá gốc</span>
              <span>Giá flash sale</span>
              <span>Giảm</span>
              <span>Stock</span>
              <span />
            </div>
            <div className="divide-y">
              {isLoadingAttached && (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                  <Loader className="size-4 animate-spin" />
                  Đang tải sản phẩm đã gắn...
                </div>
              )}
              {!isLoadingAttached && attachedProducts.length === 0 && (
                <div className="px-3 py-4 text-sm text-muted-foreground">
                  Chưa có sản phẩm nào trong flash sale này
                </div>
              )}
              {attachedProducts.map((product) => {
                const isConfirming = pendingDetachId === product._id;
                const salePrice = getAppliedSalePrice(product);
                const salePercent = getAppliedDiscountPercent(product);

                return (
                  <div
                    key={product._id}
                    className="grid items-center gap-2 px-3 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_120px_130px_90px_80px_40px]"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold line-clamp-1">{product.name}</span>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground sm:hidden">
                        <span>Gốc: {formatPrice(product.price)}</span>
                        <span>Flash: {formatPrice(salePrice)}</span>
                        <span>Giảm: {formatDiscountPercent(salePercent)}%</span>
                        <span>stock: {product.stock}</span>
                      </div>
                    </div>
                    <span className="hidden text-muted-foreground sm:block">
                      {formatPrice(product.price)}
                    </span>
                    <span className="font-semibold text-primary">
                      {formatPrice(salePrice)}
                    </span>
                    <span>{formatDiscountPercent(salePercent)}%</span>
                    <span>stock: {product.stock}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Gỡ sản phẩm khỏi flash sale"
                      disabled={isUpdating}
                      onClick={() => requestDetach(product)}
                    >
                      <X className="size-4" />
                    </Button>
                    {isConfirming && (
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 sm:col-span-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-destructive">
                            Gỡ sản phẩm này khỏi flash sale? Hành động này không thể hoàn tác.
                          </p>
                          <div className="flex gap-2 sm:justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isUpdating}
                              onClick={() => setPendingDetachId(null)}
                            >
                              Huỷ
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={isUpdating}
                              onClick={() => confirmDetach(product)}
                            >
                              {isUpdating && <Loader className="size-4 animate-spin" />}
                              Gỡ
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isUpdating}
            onClick={() => handleDialogChange(false)}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            disabled={isUpdating || !selectedProduct || selectedProductAttachedElsewhere || !hasValidSaleValue}
            onClick={handleAttach}
          >
            {isUpdating && <Loader className="size-4 animate-spin" />}
            Gắn sản phẩm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
