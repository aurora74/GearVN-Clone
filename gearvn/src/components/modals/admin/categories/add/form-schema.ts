import z from "zod";

export const fieldSchema = z.object({
  name: z.string().min(1, { message: "Tên trường là bắt buộc" }),
  label: z.string().min(1, { message: "Nhãn hiển thị là bắt buộc" }),
  type: z.enum(["text", "number"]),
  options: z.array(z.union([z.string(), z.number()])).optional(),
});

export const formSchema = z.object({
  name: z.string().min(1, { message: "Vui lòng nhập tên danh mục" }),
  label: z.string().min(1, { message: "Vui lòng nhập nhãn hiển thị" }),
  fields: z.array(fieldSchema).min(1, { message: "Phải có ít nhất 1 trường" }),
  image: z.instanceof(File, { message: "Ảnh phải là file hợp lệ" }).optional(),
});

export type FormType = z.infer<typeof formSchema>;
