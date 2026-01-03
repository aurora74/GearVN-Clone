"use client";

import { useEffect, useState } from "react";

import { Loader } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { CategoryType } from "@/types/category";
import { formSchema, FormType } from "./form-schema";
import { useUpdateCategory } from "@/react-query/mutation/category";

import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogFooter,
  DialogTrigger,
  DialogContent,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

import { FormFields } from "./form-fields";
import { ImageUpload } from "./image-upload";

type ModalEditCategoryProps = {
  category: CategoryType;
  children: React.ReactNode;
  setOpenDropdown: (open: boolean) => void;
};

export const ModalEditCategory = ({
  children,
  category,
  setOpenDropdown,
}: ModalEditCategoryProps) => {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(category.image || null);

  const form = useForm<FormType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      fields: [{ name: "", label: "", type: "text", options: [] }],
      image: undefined,
    },
  });

  const { mutate: updateCategory, isPending } = useUpdateCategory(() => {
    setOpen(false);
    form.reset();
    setOpenDropdown(false);
  });

  useEffect(() => {
    if (open && category) {
      form.reset({
        image: undefined,
        name: category.name,
        fields: category.fields || [],
      });
      setPreview(category.image || null);
    }
  }, [open, category, form]);

  const handleEdit = (values: FormType) => {
    updateCategory({ id: category._id, ...values });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa danh mục</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleEdit)}>
            <div className="h-[70vh] space-y-6 -mx-3 p-3 overflow-y-auto custom-scroll">
              <FormFields form={form} isPending={isPending} />
              <ImageUpload
                form={form}
                preview={preview}
                isPending={isPending}
                setPreview={setPreview}
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
                Cập nhật danh mục
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
