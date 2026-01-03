import { UseFormReturn } from "react-hook-form";

import { FormType } from "./form-schema";

import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormControl,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type FormFieldsProps = {
  disabled?: boolean;
  form: UseFormReturn<FormType>;
};

export const FormFields = ({ form, disabled }: FormFieldsProps) => {
  return (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tên sự kiện</FormLabel>
            <FormControl>
              <Input {...field} disabled={disabled} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="tag"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tag</FormLabel>
            <FormControl>
              <Input {...field} disabled={disabled} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};
