"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Loader } from "lucide-react";
import { useForm } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import z from "zod";

import { useCreateEvent, useUpdateEvent } from "@/react-query/mutation/event";
import { EventType } from "@/types/event";
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

const baseFormSchema = z.object({
  name: z.string().min(1, "Nhập tên flash sale"),
  tag: z.string().min(1, "Nhập tag sự kiện"),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  isEnabled: z.boolean(),
  frame: z.any().optional(),
  image: z.any().optional(),
});

const createFormSchema = (isEdit: boolean) =>
  baseFormSchema.superRefine((values, ctx) => {
    const hasStartsAt = Boolean(values.startsAt);
    const hasEndsAt = Boolean(values.endsAt);

    if (!isEdit || hasStartsAt || hasEndsAt) {
      if (!hasStartsAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["startsAt"],
          message: "Chọn thời gian bắt đầu",
        });
      }

      if (!hasEndsAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endsAt"],
          message: "Chọn thời gian kết thúc",
        });
      }
    }

    if (!isEdit && !(values.frame instanceof File)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["frame"],
        message: "Chọn khung ảnh",
      });
    }

    if (values.image !== undefined && !(values.image instanceof File)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["image"],
        message: "Ảnh chiến dịch không hợp lệ",
      });
    }

    if (!hasStartsAt || !hasEndsAt) return;

    const startsAtTime = new Date(values.startsAt ?? "").getTime();
    const endsAtTime = new Date(values.endsAt ?? "").getTime();

    if (!Number.isFinite(startsAtTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startsAt"],
        message: "Chọn thời gian bắt đầu",
      });
    }

    if (!Number.isFinite(endsAtTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "Chọn thời gian kết thúc",
      });
    }

    if (
      Number.isFinite(startsAtTime) &&
      Number.isFinite(endsAtTime) &&
      endsAtTime <= startsAtTime
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "Thời gian kết thúc phải sau thời gian bắt đầu",
      });
    }
  });

type FormValues = z.infer<typeof baseFormSchema>;

type FlashSaleFormProps = {
  event?: EventType;
  children: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
};

const toInputDateTime = (value?: string) =>
  value ? new Date(value).toISOString().slice(0, 16) : "";

const firstFile = (value: unknown) => {
  if (value instanceof File) return value;
  return value instanceof FileList ? value.item(0) ?? undefined : undefined;
};

type FileImageFieldProps = {
  form: UseFormReturn<FormValues>;
  name: "frame" | "image";
  label: string;
  preview: string | null;
  disabled?: boolean;
  setPreview: (value: string | null) => void;
};

const FileImageField = ({
  form,
  name,
  label,
  preview,
  disabled,
  setPreview,
}: FileImageFieldProps) => (
  <FormField
    control={form.control}
    name={name}
    render={() => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <div className="space-y-3">
            <label
              htmlFor={`flash-sale-${name}`}
              className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-5 text-center text-sm text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              <ImagePlus className="mb-2 size-6" />
              <span>Nhấn để chọn hoặc kéo thả ảnh vào đây</span>
              <Input
                id={`flash-sale-${name}`}
                type="file"
                accept="image/*"
                disabled={disabled}
                className="sr-only"
                onChange={(changeEvent) => {
                  const file = changeEvent.target.files?.[0];
                  if (!file) return;

                  form.setValue(name, file, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  setPreview(URL.createObjectURL(file));
                }}
              />
            </label>

            {preview && (
              <div className="relative h-44 w-full overflow-hidden rounded-md border bg-muted/20">
                <Image
                  fill
                  unoptimized
                  src={preview}
                  alt={`${label} hiện tại`}
                  className="object-contain"
                />
              </div>
            )}
          </div>
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

export const FlashSaleForm = ({
  event,
  children,
  onOpenChange,
}: FlashSaleFormProps) => {
  const [open, setOpen] = useState(false);
  const [framePreview, setFramePreview] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const isEdit = Boolean(event?._id);

  const validationSchema = useMemo(() => createFormSchema(isEdit), [isEdit]);

  const defaultValues = useMemo<FormValues>(
    () => ({
      name: event?.name ?? "",
      tag: event?.tag ?? "",
      startsAt: toInputDateTime(event?.startsAt),
      endsAt: toInputDateTime(event?.endsAt),
      isEnabled: event?.isEnabled ?? true,
      frame: undefined,
      image: undefined,
    }),
    [event]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues,
    values: defaultValues,
  });

  useEffect(() => {
    if (!open) return;

    setFramePreview(event?.frame ?? null);
    setImagePreview(event?.image ?? null);
  }, [event?.frame, event?.image, open]);

  const handleDone = () => {
    toastSuccess("Đã lưu khuyến mãi", "Flash sale đã được cập nhật.");
    form.reset();
    setOpen(false);
    setFramePreview(null);
    setImagePreview(null);
    onOpenChange?.(false);
  };

  const { mutate: createEvent, isPending: isCreating } = useCreateEvent(handleDone);
  const { mutate: updateEvent, isPending: isUpdating } = useUpdateEvent(handleDone);
  const isPending = isCreating || isUpdating;

  const submit = (values: FormValues) => {
    const frame = firstFile(values.frame);
    const image = firstFile(values.image);
    const payload = {
      name: values.name,
      tag: values.tag,
      isEnabled: values.isEnabled,
      ...(values.startsAt
        ? { startsAt: new Date(values.startsAt).toISOString() }
        : {}),
      ...(values.endsAt
        ? { endsAt: new Date(values.endsAt).toISOString() }
        : {}),
      ...(frame ? { frame } : {}),
      ...(image ? { image } : {}),
    };

    if (event?._id) {
      updateEvent({ id: event._id, ...payload });
      return;
    }

    createEvent(payload as Parameters<typeof createEvent>[0]);
  };

  const handleDialogChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setFramePreview(null);
      setImagePreview(null);
      form.reset(defaultValues);
    }

    onOpenChange?.(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto custom-scroll">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sửa flash sale" : "Tạo flash sale"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên flash sale</FormLabel>
                    <FormControl>
                      <Input disabled={isPending} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tag sự kiện</FormLabel>
                    <FormControl>
                      <Input disabled={isPending} className="uppercase" {...field} />
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
              <FileImageField
                form={form}
                name="frame"
                label="Khung ảnh"
                disabled={isPending}
                preview={framePreview}
                setPreview={setFramePreview}
              />
              <FileImageField
                form={form}
                name="image"
                label="Ảnh chiến dịch"
                disabled={isPending}
                preview={imagePreview}
                setPreview={setImagePreview}
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
