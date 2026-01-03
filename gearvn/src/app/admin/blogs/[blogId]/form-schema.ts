import z from "zod";

export const formSchema = z.object({
  title: z.string().nonempty("Vui lòng nhập tiêu đề"),
  slug: z.string().nonempty("Vui lòng nhập slug"),
  summary: z.string().nonempty("Vui lòng nhập tóm tắt"),
  description: z.string().nonempty("Vui lòng nhập nội dung"),
  thumbnail: z.union([z.instanceof(File), z.string()]),
});

export type FormType = z.infer<typeof formSchema>;
