import z from "zod";

export const formSchema = z.object({
  fullName: z
    .string()
    .nonempty("Vui lòng nhập họ tên")
    .regex(/^[\p{L} ]+$/u, "Họ tên chỉ được chứa chữ cái và khoảng cách"),
  email: z.string().nonempty("Vui lòng nhập email").email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
  phone: z
    .string()
    .optional()
    .refine((val) => !val || /^0\d{9,10}$/.test(val), {
      message: "Số điện thoại không hợp lệ",
    }),
  address: z.string().optional(),
});

export type FormType = z.infer<typeof formSchema>;
