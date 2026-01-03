import { UseFormReturn } from "react-hook-form";

import { CategoryType } from "@/types/category";

import {
  FormItem,
  FormLabel,
  FormField,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectItem,
  SelectValue,
  SelectTrigger,
  SelectContent,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type CategoryFieldsProps = {
  category: string;
  data: CategoryType;
  isSubmitting: boolean;
  form: UseFormReturn<any>;
};

export const CategoryFields = ({
  data,
  form,
  category,
  isSubmitting,
}: CategoryFieldsProps) => {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase">
        {`Thuộc tính ${category}`}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.fields.map((field) => (
          <FormField
            key={field.name}
            control={form.control}
            name={`attributes.${field.name}`}
            render={({ field: rhfField }) => {
              const handleChange = (val: string | number) =>
                rhfField.onChange(field.type === "number" ? Number(val) : val);

              return (
                <FormItem>
                  <FormLabel>{field.label}</FormLabel>
                  <FormControl>
                    {field.options?.length ? (
                      <Select
                        disabled={isSubmitting}
                        onValueChange={handleChange}
                        value={rhfField.value?.toString() || ""}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={`Chọn ${field.label.toLowerCase()}`}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map((opt) => (
                            <SelectItem
                              key={opt.toString()}
                              value={opt.toString()}
                            >
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        disabled={isSubmitting}
                        value={rhfField.value || ""}
                        onChange={(e) => handleChange(e.target.value)}
                        placeholder={`Nhập ${field.label.toLowerCase()}`}
                        type={field.type === "number" ? "number" : "text"}
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        ))}
      </div>
    </div>
  );
};
