import z from "zod";

const phoneRegex = /^0\d{9}$/;

export const formSchema = z
  .object({
    useAccountInfo: z.boolean(),
    note: z.string().optional(),
    phone: z.string().optional(),
    street: z.string().optional(),
    ward: z.string().optional(),
    district: z.string().optional(),
    province: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.useAccountInfo) {
      if (!data.phone?.trim()) {
        ctx.addIssue({
          path: ["phone"],
          message: "Vui lòng nhập số điện thoại",
          code: z.ZodIssueCode.custom,
        });
      } else if (!phoneRegex.test(data.phone)) {
        ctx.addIssue({
          path: ["phone"],
          message: "Số điện thoại không hợp lệ (phải có 10 số, bắt đầu bằng 0)",
          code: z.ZodIssueCode.custom,
        });
      }

      if (!data.street?.trim()) {
        ctx.addIssue({
          path: ["street"],
          message: "Vui lòng nhập tên đường",
          code: z.ZodIssueCode.custom,
        });
      }
      if (!data.ward) {
        ctx.addIssue({
          path: ["ward"],
          message: "Vui lòng chọn phường/xã",
          code: z.ZodIssueCode.custom,
        });
      }
      if (!data.district) {
        ctx.addIssue({
          path: ["district"],
          message: "Vui lòng chọn quận/huyện",
          code: z.ZodIssueCode.custom,
        });
      }
      if (!data.province) {
        ctx.addIssue({
          path: ["province"],
          message: "Vui lòng chọn tỉnh/thành phố",
          code: z.ZodIssueCode.custom,
        });
      }
    }
  });

export type FormType = z.infer<typeof formSchema>;
