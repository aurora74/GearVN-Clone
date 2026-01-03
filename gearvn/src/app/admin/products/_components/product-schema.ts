import { z } from "zod";

export const productSchema = z
  .object({
    name: z.string().nonempty("Vui lòng nhập tên sản phẩm"),
    slug: z
      .string()
      .min(1, "Vui lòng nhập slug")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug không hợp lệ"),
    event: z.string().optional(),
    category: z.string().nonempty("Vui lòng chọn loại sản phẩm"),

    price: z.number().min(0, "Giá phải lớn hơn hoặc bằng 0"),

    discountPrice: z
      .number()
      .min(0, "Giá sau giảm phải lớn hơn hoặc bằng 0")
      .optional(),

    discountPercent: z
      .number()
      .min(0, "Phần trăm giảm giá phải lớn hơn hoặc bằng 0")
      .max(100, "Phần trăm giảm giá không được vượt quá 100")
      .optional(),

    description: z.string().optional(),

    images: z
      .array(
        z.union([
          z.string().url("Ảnh phải là đường dẫn hợp lệ"),
          z.instanceof(File).refine((file) => file.type.startsWith("image/"), {
            message: "File phải là ảnh",
          }),
        ])
      )
      .min(1, "Vui lòng chọn ít nhất một ảnh"),

    attributes: z
      .record(z.string(), z.union([z.string(), z.number(), z.undefined()]))
      .optional(),

    stock: z.number().int().min(0, "Số lượng phải lớn hơn hoặc bằng 0"),
  })
  .refine(
    (data) =>
      data.discountPrice === undefined || data.discountPrice <= data.price,
    {
      message: "Giá sau giảm phải nhỏ hơn hoặc bằng giá gốc",
      path: ["discountPrice"],
    }
  )
  .refine(
    (data) => data.discountPercent === undefined || data.discountPercent <= 100,
    {
      message: "Phần trăm giảm giá không được vượt quá 100",
      path: ["discountPercent"],
    }
  );

export type FormType = z.infer<typeof productSchema>;
