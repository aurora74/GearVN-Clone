"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import slugify from "slugify";
import { ImageIcon, Loader, X } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { formSchema, FormType } from "./form-schema";
import { useCreateBlog } from "@/react-query/mutation/blog";

import {
  Form,
  FormItem,
  FormField,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { Hint } from "@/components/global/hint";

const SimpleEditor = dynamic(
  () =>
    import("@/components/global/admin/simple-editor").then(
      (m) => m.SimpleEditor
    ),
  { ssr: false }
);

const CreateBlogPage = () => {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);

  const form = useForm<FormType>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", slug: "", summary: "", description: "" },
  });

  const titleValue = useWatch({ control: form.control, name: "title" });

  useEffect(() => {
    form.setValue(
      "slug",
      slugify(titleValue || "", { lower: true, strict: true })
    );
  }, [titleValue, form]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    form.setValue("thumbnail", file);
    form.trigger("thumbnail");

    const url = URL.createObjectURL(file);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  };

  const removeImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    form.setValue("thumbnail", undefined);
    form.trigger("thumbnail");
    setPreview(null);
  };

  const { mutate: createBlog, isPending } = useCreateBlog(() => {
    form.reset();
    setPreview(null);
    router.replace("/admin/blogs");
  });

  const handleCreate = (values: FormType) => {
    createBlog(values);
  };

  return (
    <div className="flex-1 h-[calc(100vh-60px)] flex flex-col gap-6 pt-4 mb-12 sm:mb-0 sm:mx-2.5 border bg-white shadow-sm rounded-md">
      <h1 className="text-xl font-semibold px-4">Tạo bài viết mới</h1>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleCreate)}
          className="flex-1 flex flex-col gap-6 px-4 overflow-y-auto custom-scroll"
        >
          <fieldset disabled={isPending} className="contents">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tiêu đề</FormLabel>
                  <FormControl>
                    <Input placeholder="Nhập tiêu đề bài viết" {...field} />
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
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input
                      readOnly
                      {...field}
                      placeholder="Tự động tạo từ tiêu đề"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tóm tắt</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Tóm tắt bài viết" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="thumbnail"
              render={() => (
                <FormItem>
                  <FormLabel>Thumbnail</FormLabel>
                  <FormControl>
                    {!preview ? (
                      <label
                        htmlFor="thumbnail"
                        className="w-full h-40 flex flex-col items-center justify-center border-2 border-dashed border-muted hover:border-primary hover:bg-muted/40 rounded-md cursor-pointer transition"
                      >
                        <ImageIcon className="size-6 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Click hoặc kéo ảnh vào đây
                        </p>
                        <input
                          type="file"
                          id="thumbnail"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageChange}
                        />
                      </label>
                    ) : (
                      <div className="w-full relative group flex justify-center mt-4">
                        <div className="relative w-[640px] h-[360px]">
                          <Image
                            fill
                            src={preview}
                            alt="Thumbnail preview"
                            className="object-contain rounded-md"
                          />
                          <Hint label="Xóa ảnh">
                            <Button
                              size="icon"
                              type="button"
                              variant="ghost"
                              onClick={removeImage}
                              className="absolute top-2 right-2 size-8 flex items-center justify-center text-accent-foreground bg-accent opacity-0 group-hover:opacity-100 transition"
                            >
                              <X className="size-4" />
                            </Button>
                          </Hint>
                        </div>
                      </div>
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nội dung</FormLabel>
                  <FormControl>
                    <SimpleEditor field={field} disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>

          <div className="sticky bottom-0 flex justify-end gap-2 py-3 mt-auto border-t bg-white z-10">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.history.back()}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader className="size-4 animate-spin" />}
              Đăng bài viết
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default CreateBlogPage;
