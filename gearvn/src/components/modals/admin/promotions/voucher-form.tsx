"use client";

import { useMemo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "lucide-react";
import { useForm } from "react-hook-form";
import z from "zod";

import { VOUCHER_DISCOUNT_TYPE } from "@/config.global";
import { useCreateVoucher, useUpdateVoucher } from "@/react-query/mutation/voucher";
import { VoucherType } from "@/types/voucher";
import { toastSuccess } from "@/components/ui/toaster";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z
  .object({
    code: z.string().min(1, "Nhập mã voucher"),
    discountType: z.enum([
      VOUCHER_DISCOUNT_TYPE.PERCENTAGE,
      VOUCHER_DISCOUNT_TYPE.FIXED_AMOUNT,
    ]),
    discountValue: z.coerce.number().positive("Giá trị giảm phải lớn hơn 0"),
    minimumOrderValue: z.coerce.number().min(0, "Đơn tối thiểu không hợp lệ"),
    maximumDiscountAmount: z.coerce.number().min(0).optional(),
    startsAt: z.string().min(1, "Chọn thời gian bắt đầu"),
    endsAt: z.string().min(1, "Chọn thời gian kết thúc"),
    usageLimit: z.coerce.number().int().positive("Giới hạn lượt dùng phải lớn hơn 0"),
    isEnabled: z.boolean(),
  })
  .refine((values) => new Date(values.endsAt) > new Date(values.startsAt), {
    path: ["endsAt"],
    message: "Thời gian kết thúc phải sau thời gian bắt đầu",
  });

type FormValues = z.output<typeof formSchema>;

type VoucherFormProps = {
  voucher?: VoucherType;
  children: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
};

const toInputDateTime = (value?: string) =>
  value ? new Date(value).toISOString().slice(0, 16) : "";

export const VoucherForm = ({
  voucher,
  children,
  onOpenChange,
}: VoucherFormProps) => {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(voucher?._id);

  const defaultValues = useMemo<FormValues>(
    () => ({
      code: voucher?.code ?? "",
      discountType: voucher?.discountType ?? VOUCHER_DISCOUNT_TYPE.PERCENTAGE,
      discountValue: voucher?.discountValue ?? 0,
      minimumOrderValue: voucher?.minimumOrderValue ?? 0,
      maximumDiscountAmount: voucher?.maximumDiscountAmount ?? undefined,
      startsAt: toInputDateTime(voucher?.startsAt),
      endsAt: toInputDateTime(voucher?.endsAt),
      usageLimit: voucher?.usageLimit ?? 1,
      isEnabled: voucher?.isEnabled ?? true,
    }),
    [voucher]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues,
    values: defaultValues,
  });

  const handleDone = () => {
    toastSuccess("Đã lưu khuyến mãi", "Voucher đã được cập nhật.");
    form.reset();
    setOpen(false);
    onOpenChange?.(false);
  };

  const { mutate: createVoucher, isPending: isCreating } =
    useCreateVoucher(handleDone);
  const { mutate: updateVoucher, isPending: isUpdating } =
    useUpdateVoucher(handleDone);
  const isPending = isCreating || isUpdating;

  const submit = (values: FormValues) => {
    const payload = {
      ...values,
      code: values.code.trim().toUpperCase(),
      startsAt: new Date(values.startsAt).toISOString(),
      endsAt: new Date(values.endsAt).toISOString(),
      maximumDiscountAmount: values.maximumDiscountAmount || undefined,
    };

    if (voucher?._id) {
      updateVoucher({ id: voucher._id, ...payload });
      return;
    }

    createVoucher(payload);
  };

  const handleDialogChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto custom-scroll">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sửa voucher" : "Tạo voucher"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mã voucher</FormLabel>
                    <FormControl>
                      <Input disabled={isPending} className="uppercase" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loại giảm giá</FormLabel>
                    <Select
                      disabled={isPending}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={VOUCHER_DISCOUNT_TYPE.PERCENTAGE}>
                          Phần trăm
                        </SelectItem>
                        <SelectItem value={VOUCHER_DISCOUNT_TYPE.FIXED_AMOUNT}>
                          Số tiền cố định
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discountValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Giá trị giảm</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} disabled={isPending} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="minimumOrderValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Đơn tối thiểu</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} disabled={isPending} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maximumDiscountAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Giảm tối đa</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} disabled={isPending} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="usageLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Giới hạn lượt dùng</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} disabled={isPending} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bắt đầu</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" disabled={isPending} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kết thúc</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" disabled={isPending} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 sm:col-span-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        disabled={isPending}
                        onCheckedChange={(value) => field.onChange(Boolean(value))}
                      />
                    </FormControl>
                    <FormLabel className="m-0">Cho phép áp dụng</FormLabel>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => handleDialogChange(false)}
              >
                Huỷ
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader className="size-4 animate-spin" />}
                Đã lưu khuyến mãi
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
