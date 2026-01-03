"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import slugify from "slugify";
import { Loader } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useProduct } from "@/react-query/query/product";
import { useUpdateProduct } from "@/react-query/mutation/product";

import { ProductFormFields } from "../_components/product-form-fields";
import { FormType, productSchema } from "../_components/product-schema";

const EditProductPage = () => {
  const router = useRouter();
  const [isFormReady, setIsFormReady] = useState(false);

  const params = useParams<{ productId: string }>();
  const productId = params.productId;

  const { data: product, isPending: isPendingProduct } = useProduct(productId);

  const form = useForm<FormType>({
    resolver: zodResolver(productSchema),
    defaultValues: {
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
    },
  });

  useEffect(() => {
    if (!product) return;
    form.reset({
      name: product.name,
      slug: product.slug,
      stock: product.stock,
      price: product.price,
      event: product.event ?? "",
      category: product.category,
      images: product.images ?? [],
      attributes: product.attributes ?? {},
      description: product.description ?? "",
      discountPrice: product.discountPrice ?? 0,
      discountPercent: product.discountPercent ?? 0,
    });
    setIsFormReady(true);
  }, [product, form]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "name" && value.name) {
        form.setValue(
          "slug",
          slugify(value.name, { lower: true, strict: true })
        );
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const { mutate: updateProduct, isPending } = useUpdateProduct(() => {
    router.replace("/admin/products");
  });

  const handleEdit = (data: FormType) => {
    updateProduct({ id: product?._id || "", ...data });
  };

  return (
    <div className="flex-1 h-[calc(100vh-60px)] flex flex-col gap-6 pt-4 mb-12 sm:mb-0 sm:mx-2.5 border bg-white shadow-sm rounded-md">
      <h1 className="text-xl font-semibold px-4">Chỉnh sửa sản phẩm</h1>
      {isPendingProduct || !isFormReady ? (
        <div className="h-full flex flex-col items-center justify-center gap-2">
          <Loader className="size-7 text-primary animate-spin" />
          <p>Đang tải...</p>
        </div>
      ) : (
        <ProductFormFields
          isEdit
          form={form}
          onSubmit={handleEdit}
          isPending={isPending}
        />
      )}
    </div>
  );
};

export default EditProductPage;
