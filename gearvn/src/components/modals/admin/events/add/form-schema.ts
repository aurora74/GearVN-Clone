import z from "zod";

export const formSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên sự kiện"),
  frame: z
    .any()
    .refine((file) => file instanceof File, "Vui lòng chọn ảnh khung"),
  image: z
    .any()
    .optional()
    .refine(
      (file) => file === undefined || file instanceof File,
      "Ảnh sự kiện không hợp lệ"
    ),
  tag: z.string().min(1, "Vui lòng nhập tag"),
});

export type FormType = z.infer<typeof formSchema>;
