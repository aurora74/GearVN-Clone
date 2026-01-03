import z from "zod";

export const formSchema = z.object({
  fullName: z.string().nonempty("Vui lòng nhập họ tên"),
  phone: z
    .string()
    .nonempty("Vui lòng nhập số điện thoại")
    .regex(/^\d{9,12}$/, "Số điện thoại không hợp lệ"),
  street: z.string().nonempty("Vui lòng nhập tên đường"),
  ward: z.string().nonempty("Vui lòng chọn phường / xã"),
  district: z.string().nonempty("Vui lòng chọn quận / huyện"),
  province: z.string().nonempty("Vui lòng chọn tỉnh / thành phố"),
});

export type FormType = z.infer<typeof formSchema>;
