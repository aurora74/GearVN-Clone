"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import slugify from "slugify";
import { useForm, useWatch } from "react-hook-form";
import { ImageIcon, Loader, X } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";

import { formSchema, FormType } from "./form-schema";

import { useBlog } from "@/react-query/query/blog";
import { useUpdateBlog } from "@/react-query/mutation/blog";

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
import { SimpleEditor } from "@/components/global/admin/simple-editor";

const EditBlogPage = () => {
  const router = useRouter();
  const params = useParams<{ blogId: string }>();

  const [isFormReady, setIsFormReady] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const { data: blog, isPending: isPendingBlog } = useBlog(params.blogId);

  const { mutate: updateBlog, isPending: isUpdatingBlog } = useUpdateBlog(
    params.blogId,
    () => router.replace("/admin/blogs")
  );

  const form = useForm<FormType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      slug: "",
      title: "",
      summary: "",
      thumbnail: "",
      description: "",
    },
  });

  useEffect(() => {
    if (!blog) return;

    form.reset({
      slug: blog.slug,
      title: blog.title,
      summary: blog.summary,
      thumbnail: blog.thumbnail,
      description: blog.description,
    });

    setIsFormReady(true);
    setPreview(blog.thumbnail);
  }, [blog, form]);

  const titleValue = useWatch({ control: form.control, name: "title" });

  useEffect(() => {
    const slug = slugify(titleValue || "", { lower: true, strict: true });
    form.setValue("slug", slug);
  }, [titleValue, form]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    form.setValue("thumbnail", file);
    form.trigger("thumbnail");

    const url = URL.createObjectURL(file);
    setPreview((prev) => {
      if (prev && prev !== blog?.thumbnail) URL.revokeObjectURL(prev);
      return url;
    });
  };

  const removeImage = () => {
    form.setValue("thumbnail", "");
    form.trigger("thumbnail");
    if (preview && preview !== blog?.thumbnail) URL.revokeObjectURL(preview);
    setPreview(null);
  };

  const handleUpdate = (values: FormType) => {
    updateBlog(values);
  };

  return (
    <div className="flex-1 h-[calc(100vh-60px)] flex flex-col gap-6 pt-4 mb-12 sm:mb-0 sm:mx-2.5 border bg-white shadow-sm rounded-md">
      {isPendingBlog || !isFormReady ? (
        <div className="h-full flex flex-col items-center justify-center gap-2">
          <Loader className="size-7 text-primary animate-spin" />
          <p>Đang tải...</p>
        </div>
      ) : (
        <>
          <h1 className="text-xl font-semibold px-4">Chỉnh sửa bài viết</h1>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleUpdate)}
              className="flex-1 h-[calc(100vh-20px)] flex flex-col gap-6 px-4 overflow-y-auto custom-scroll"
            >
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tiêu đề</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={isUpdatingBlog}
                        placeholder="Nhập tiêu đề bài viết"
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
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly disabled />
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
                      <Textarea {...field} disabled={isUpdatingBlog} />
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
                          className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-muted hover:bg-muted/40 rounded-md cursor-pointer transition"
                        >
                          <ImageIcon className="size-6 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">
                            Click hoặc kéo ảnh vào đây
                          </p>
                          <input
                            type="file"
                            id="thumbnail"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                          />
                        </label>
                      ) : (
                        <div className="group relative flex justify-center mt-4">
                          <Image
                            width={400}
                            height={400}
                            src={preview}
                            alt="Thumbnail preview"
                            className="object-contain rounded-sm"
                          />
                          <Button
                            size="icon"
                            type="button"
                            variant="ghost"
                            disabled={isUpdatingBlog}
                            onClick={removeImage}
                            className="absolute top-2 right-2 size-8 bg-accent text-accent-foreground opacity-0 group-hover:opacity-100 transition"
                          >
                            <X className="size-4" />
                          </Button>
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
                      <SimpleEditor field={field} disabled={isUpdatingBlog} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="sticky bottom-0 flex justify-end gap-2 py-3 mt-auto border-t bg-white z-10">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isUpdatingBlog}
                  onClick={() => window.history.back()}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={isUpdatingBlog}>
                  {isUpdatingBlog && <Loader className="size-4 animate-spin" />}
                  Cập nhật bài viết
                </Button>
              </div>
            </form>
          </Form>
        </>
      )}
    </div>
  );
};

export default EditBlogPage;
