import { Control } from "react-hook-form";

import { FormType } from "./form-schema";

import {
  FormItem,
  FormField,
  FormLabel,
  FormMessage,
  FormControl,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type InputFieldProps = {
  label: string;
  isPending?: boolean;
  placeholder: string;
  name: keyof FormType;
  control: Control<FormType>;
};

export const InputField = ({
  name,
  label,
  control,
  placeholder,
  isPending = false,
}: InputFieldProps) => (
  <FormField
    name={name}
    control={control}
    render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <Input {...field} disabled={isPending} placeholder={placeholder} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);
