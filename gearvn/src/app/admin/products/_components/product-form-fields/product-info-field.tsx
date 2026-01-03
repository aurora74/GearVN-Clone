import { useEffect } from "react";

import slugify from "slugify";
import { UseFormReturn, ControllerRenderProps } from "react-hook-form";

import { FormType } from "../product-schema";
import { CategoryType } from "@/types/category";
import { useDebounce } from "@/hooks/use-debounce";
import { useEvents } from "@/react-query/query/event";

import { parseNumber } from "@/utils/parse-number";
import { formatPrice } from "@/utils/format/format-price";
import { formatNumber } from "@/utils/format/format-number";

import {
  FormItem,
  FormField,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectItem,
  SelectValue,
  SelectTrigger,
  SelectContent,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type ProductInfoFieldProps = {
  isPending: boolean;
  data?: CategoryType[];
  form: UseFormReturn<FormType>;
};

export const ProductInfoField = ({
  data,
  form,
  isPending,
}: ProductInfoFieldProps) => {
  const { data: events } = useEvents();

  const nameValue = form.watch("name");
  const debouncedName = useDebounce(nameValue, 300);

  useEffect(() => {
    const slug = debouncedName
      ? slugify(debouncedName, { lower: true, strict: true })
      : "";
    form.setValue("slug", slug);
  }, [debouncedName, form]);

  const syncDiscountValues = (
    form: UseFormReturn<FormType>,
    price: number,
    percent: number
  ) => {
    const discountPrice = Math.max(price - (price * percent) / 100, 0);
    form.setValue("discountPercent", percent);
    form.setValue("discountPrice", Math.round(discountPrice));
  };

  const handleStockChange = (
    field: ControllerRenderProps<FormType, "stock">,
    value: string
  ) => {
    const raw = parseNumber(value);
    if (/^\d*$/.test(raw)) {
      field.onChange(raw ? parseInt(raw, 10) : undefined);
    }
  };

  const handlePriceChange = (
    field: ControllerRenderProps<FormType, "price">,
    value: string
  ) => {
    const raw = parseNumber(value);
    const price = Number(raw) || 0;
    field.onChange(price);

    const percent = form.getValues("discountPercent") || 0;
    syncDiscountValues(form, price, percent);
  };

  const handlePercentChange = (
    field: ControllerRenderProps<FormType, "discountPercent">,
    value: string
  ) => {
    const raw = parseNumber(value);
    const percent = Math.min(Math.max(Number(raw), 0), 100);
    field.onChange(percent);

    const price = form.getValues("price") || 0;
    syncDiscountValues(form, price, percent);
  };

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase">
        Thông tin chung
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Tên sản phẩm <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  disabled={isPending}
                  placeholder="Nhập tên sản phẩm"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug sản phẩm</FormLabel>
              <FormControl>
                <Input
                  readOnly
                  {...field}
                  disabled={isPending}
                  placeholder="Slug sẽ được tạo tự động"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Loại sản phẩm <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  disabled={isPending}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn loại sản phẩm" />
                  </SelectTrigger>
                  <SelectContent>
                    {data?.map((item) => (
                      <SelectItem key={item.name} value={item.name}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="event"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sự kiện</FormLabel>
              <FormControl>
                <Select
                  disabled={isPending}
                  value={field.value || ""}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn sự kiện" />
                  </SelectTrigger>
                  <SelectContent>
                    {events?.data?.map((event) => (
                      <SelectItem key={event._id} value={event.tag}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="stock"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Số lượng <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="text"
                  inputMode="numeric"
                  disabled={isPending}
                  placeholder="Nhập số lượng"
                  value={formatNumber(field.value)}
                  onChange={(e) => handleStockChange(field, e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Giá gốc (VNĐ) <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    inputMode="numeric"
                    disabled={isPending}
                    placeholder="Nhập giá gốc"
                    value={formatPrice(field.value)}
                    onChange={(e) => handlePriceChange(field, e.target.value)}
                    className="pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ₫
                  </span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="discountPercent"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Giảm giá (%)</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    inputMode="numeric"
                    disabled={isPending}
                    placeholder="Nhập phần trăm giảm"
                    value={field.value?.toString() || ""}
                    onChange={(e) => handlePercentChange(field, e.target.value)}
                    className="pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="discountPrice"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Giá sau giảm (VNĐ)</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    readOnly
                    inputMode="numeric"
                    disabled={isPending}
                    placeholder="Nhập giá sau giảm"
                    value={formatPrice(field.value)}
                    className="pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ₫
                  </span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};
