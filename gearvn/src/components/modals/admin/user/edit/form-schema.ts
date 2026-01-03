import z from "zod";

export const formSchema = z.object({
  email: z.string().nonempty("Vui lòng nhập email").email("Email không hợp lệ"),
  fullName: z
    .string()
    .nonempty("Vui lòng nhập họ tên")
    .regex(/^[\p{L} ]+$/u, "Họ tên chỉ được chứa chữ cái và khoảng cách"),
  phone: z
    .string()
    .optional()
    .refine((val) => !val || /^0\d{9,10}$/.test(val), {
      message: "Số điện thoại không hợp lệ",
    }),
  address: z.string().optional(),
});

export type FormType = z.infer<typeof formSchema>;
