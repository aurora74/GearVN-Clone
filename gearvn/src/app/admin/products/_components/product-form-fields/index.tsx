import { Loader } from "lucide-react";
import { UseFormReturn } from "react-hook-form";

import { FormType } from "../product-schema";
import { CategoryType } from "@/types/category";
import { useCategories } from "@/react-query/query/category";

import {
  Form,
  FormItem,
  FormField,
  FormLabel,
  FormMessage,
  FormControl,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";

import { CategoryFields } from "./category-fields";
import { ProductInfoField } from "./product-info-field";
import { ProductImageField } from "./product-image-field";

import { SimpleEditor } from "@/components/global/admin/simple-editor";

type ProductFormFieldsProps = {
  isEdit?: boolean;
  isPending: boolean;
  form: UseFormReturn<FormType>;
  onSubmit: (values: FormType) => void;
};

export const ProductFormFields = ({
  form,
  onSubmit,
  isPending,
  isEdit = false,
}: ProductFormFieldsProps) => {
  const { data: categories, isPending: isPendingCategory } = useCategories();

  const category = form.watch("category");

  const selectedCategory = categories?.data.find(
    (c: CategoryType) => c.name === category
  );

  const handleSubmit = (data: FormType) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex-1 flex flex-col gap-6 px-4 overflow-y-auto custom-scroll"
      >
        {isPendingCategory || !categories ? (
          <div className="h-full flex flex-col items-center justify-center gap-2">
            <Loader className="size-6 animate-spin text-primary" />
            <p>Đang tải...</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-6">
              <ProductInfoField
                form={form}
                isPending={isPending}
                data={categories.data}
              />

              {selectedCategory && (
                <CategoryFields
                  form={form}
                  category={category}
                  data={selectedCategory}
                  isSubmitting={isPending}
                />
              )}

              <FormField
                name="description"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mô tả</FormLabel>
                    <FormControl>
                      <SimpleEditor field={field} disabled={isPending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ProductImageField form={form} isPending={isPending} />
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 py-3 mt-auto bg-white border-t z-10">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => window.history.back()}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader className="size-4 animate-spin" />}
                {isEdit ? "Cập nhật sản phẩm" : "Tạo sản phẩm"}
              </Button>
            </div>
          </>
        )}
      </form>
    </Form>
  );
};
