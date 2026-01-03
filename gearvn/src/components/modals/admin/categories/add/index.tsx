"use client";

import { useRef, useState } from "react";

import { Loader, Plus } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";

import { formSchema, FormType } from "./form-schema";
import { useCreateCategory } from "@/react-query/mutation/category";

import {
  Form,
  FormItem,
  FormField,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogFooter,
  DialogTrigger,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FieldItem } from "./field-item";
import { ImageUpload } from "./image-upload";

export const ModalAddCategory = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [expandedOptions, setExpandedOptions] = useState<
    Record<number, boolean>
  >({});

  const form = useForm<FormType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      label: "",
      name: "",
      fields: [{ name: "", label: "", type: "text", options: [] }],
    },
  });

  const { append, remove, fields } = useFieldArray({
    control: form.control,
    name: "fields",
  });

  const scrollToBottom = () => {
    setTimeout(() => {
      containerRef.current?.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
  };

  const { mutate: createCategory, isPending } = useCreateCategory(() => {
    form.reset();
    setOpen(false);
    setPreview(null);
  });

  const handleAdd = (values: FormType) => {
    createCategory(values);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Thêm danh mục mới</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleAdd)}>
            <div
              ref={containerRef}
              className="h-[70vh] space-y-6 -mx-3 p-3 overflow-y-auto custom-scroll"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên danh mục</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={isPending}
                        placeholder="VD: Monitor"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nhãn hiển thị</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={isPending}
                        placeholder="VD: Màn hình"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-4">
                <h3 className="text-lg font-semibold">Thuộc tính</h3>
                {fields.map((item, index) => (
                  <FieldItem
                    form={form}
                    index={index}
                    key={item.id}
                    remove={remove}
                    isPending={isPending}
                    scrollToBottom={scrollToBottom}
                    expanded={!!expandedOptions[index]}
                    toggleExpand={() =>
                      setExpandedOptions((prev) => ({
                        ...prev,
                        [index]: !prev[index],
                      }))
                    }
                  />
                ))}

                <Button
                  type="button"
                  variant={"ghost"}
                  disabled={isPending}
                  onClick={() => {
                    scrollToBottom();
                    append({ name: "", label: "", type: "text", options: [] });
                  }}
                  className="ml-auto"
                >
                  <Plus className="h-4 w-4" /> Thêm trường
                </Button>
              </div>

              <FormField
                control={form.control}
                name="image"
                render={() => (
                  <FormItem>
                    <FormLabel>Ảnh</FormLabel>
                    <FormControl>
                      <ImageUpload
                        form={form}
                        preview={preview}
                        isPending={isPending}
                        setPreview={setPreview}
                        scrollToBottom={scrollToBottom}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="flex justify-end gap-3 mt-4">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setOpen(false)}
              >
                Huỷ
              </Button>

              <Button type="submit" disabled={isPending}>
                {isPending && <Loader className="size-4 animate-spin" />}
                Thêm danh mục
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
