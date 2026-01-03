"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import slugify from "slugify";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useCreateProduct } from "@/react-query/mutation/product";

import { ProductFormFields } from "../_components/product-form-fields";
import { FormType, productSchema } from "../_components/product-schema";

const CreateProductPage = () => {
  const router = useRouter();

  const defaultValues = useMemo<FormType>(
    () => ({
      name: "",
      slug: "",
      event: "",
      price: 0,
      stock: 0,
      images: [],
      category: "",
      attributes: {},
      description: "",
      discountPrice: 0,
      discountPercent: 0,
    }),
    []
  );

  const form = useForm<FormType>({
    resolver: zodResolver(productSchema),
    defaultValues,
  });

  const nameValue = form.watch("name");
  useEffect(() => {
    if (!nameValue) return;
    const slug = slugify(nameValue, { lower: true, strict: true });
    form.setValue("slug", slug);
  }, [nameValue, form]);

  const { mutate: createProduct, isPending } = useCreateProduct(() => {
    router.replace("/admin/products");
    form.reset(defaultValues);
  });

  const handleCreate = (data: FormType) => {
    createProduct(data);
  };

  return (
    <div className="flex-1 h-[calc(100vh-60px)] flex flex-col gap-6 pt-4 mb-12 sm:mb-0 sm:mx-2.5 border bg-white shadow-sm rounded-md">
      <h1 className="text-xl font-semibold px-4">Tạo sản phẩm mới</h1>
      <ProductFormFields
        form={form}
        isPending={isPending}
        onSubmit={handleCreate}
      />
    </div>
  );
};

export default CreateProductPage;
