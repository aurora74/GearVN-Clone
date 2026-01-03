import z from "zod";

export const formSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên sự kiện"),
  tag: z.string().min(1, "Vui lòng nhập tag"),
  frame: z.any().optional(),
  image: z.any().optional(),
});

export type FormType = z.infer<typeof formSchema>;
