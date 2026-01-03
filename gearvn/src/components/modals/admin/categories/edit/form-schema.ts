import z from "zod";

export const fieldSchema = z.object({
  name: z.string().min(1, { message: "Vui lòng nhập tên trường" }),
  label: z.string().min(1, { message: "Vui lòng nhập nhãn hiển thị" }),
  type: z.enum(["text", "number"], {
    message: "Vui lòng chọn loại dữ liệu hợp lệ",
  }),
  options: z.array(z.union([z.string(), z.number()])).optional(),
});

export const formSchema = z.object({
  name: z.string().min(1, { message: "Vui lòng nhập tên danh mục" }),
  fields: z
    .array(fieldSchema)
    .min(1, { message: "Vui lòng thêm ít nhất 1 trường" }),
  image: z
    .union([
      z.instanceof(File, { message: "Ảnh phải là file hợp lệ" }),
      z.string().url({ message: "Ảnh phải là link hợp lệ" }),
    ])
    .optional(),
});

export type FormType = z.infer<typeof formSchema>;
