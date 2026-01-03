"use client";

import {
  FormItem,
  FormLabel,
  FormMessage,
  FormControl,
} from "@/components/ui/form";
import {
  Select,
  SelectItem,
  SelectValue,
  SelectTrigger,
  SelectContent,
} from "@/components/ui/select";

type Option = { code: string | number; name: string };

type SelectAddressProps = {
  label: string;
  options: Option[];
  disabled?: boolean;
  placeholder?: string;
  field: { value: string; onChange: (value: string) => void };
};

export const SelectAddress = ({
  label,
  field,
  options,
  disabled,
  placeholder,
}: SelectAddressProps) => {
  const defaultPlaceholder = placeholder || `Chọn ${label.toLowerCase()}`;

  return (
    <FormItem>
      <FormLabel aria-required="true">{label}</FormLabel>

      <Select
        disabled={disabled}
        value={field.value || ""}
        onValueChange={(value) => field.onChange(value)}
      >
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder={defaultPlaceholder} />
          </SelectTrigger>
        </FormControl>

        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={String(opt.code)} value={String(opt.code)}>
              {opt.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  );
};
