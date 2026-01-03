import { FormType } from "./form-schema";
import { AddressItem } from "@/hooks/use-vietnam-address";

import { SelectAddress } from "./select-address";

import { FormField } from "@/components/ui/form";

type FormFieldAddressProps = {
  name: keyof FormType;
  control: any;
  options: AddressItem[];
  label: string;
  placeholder?: string;
  disabled?: boolean;
};

export const FormFieldAddress = ({
  name,
  control,
  options,
  label,
  placeholder = "Chọn...",
  disabled,
}: FormFieldAddressProps) => (
  <FormField
    name={name}
    control={control}
    render={({ field }) => (
      <SelectAddress
        field={field}
        options={options}
        label={label}
        placeholder={placeholder}
        disabled={disabled}
      />
    )}
  />
);
