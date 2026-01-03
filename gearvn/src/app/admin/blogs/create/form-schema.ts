import z from "zod";

export const formSchema = z.object({
  title: z.string().nonempty("Vui lòng nhập tiêu đề"),
  slug: z.string().nonempty("Vui lòng nhập slug"),
  summary: z.string().nonempty("Vui lòng nhập tóm tắt"),
  description: z.string().nonempty("Vui lòng nhập nội dung"),
  thumbnail: z
    .any()
    .refine((file) => file instanceof File, {
      message: "Vui lòng chọn ảnh bìa",
    }),
});

export type FormType = z.infer<typeof formSchema>;
