import { Info } from "lucide-react";
import { Icon } from "@iconify/react";

import { ProductType } from "@/types/product";
import { CategoryFields } from "@/types/category";

import { getIconForAttribute } from "@/utils/get/get-icon-for-attribute";
import { formatProductAttributes } from "@/utils/format/format-product-attributes";

type ProductConfigurationProps = {
  product: ProductType;
  fields: CategoryFields[];
};

export const ProductConfiguration = ({
  fields,
  product,
}: ProductConfigurationProps) => {
  const isEmpty = fields.length === 0;

  if (isEmpty) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
        <Info className="size-5" />
        <p>Sản phẩm chưa có cấu hình.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y rounded-md">
      {fields.map(({ name, label }) => {
        const icon = getIconForAttribute(name);
        const rawValue = product.attributes?.[name];

        return (
          <div
            key={name}
            className="flex items-center justify-between gap-2 text-sm p-3 hover:bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <Icon icon={icon} className="size-4 text-muted-foreground" />
              <span className="text-gray-700">{label}</span>
            </div>
            <span className="font-medium text-right">
              {formatProductAttributes(rawValue)}
            </span>
          </div>
        );
      })}
    </div>
  );
};
