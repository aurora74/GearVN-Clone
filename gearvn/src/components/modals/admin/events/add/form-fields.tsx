"use client";

import { UseFormReturn } from "react-hook-form";

import { FormType } from "./form-schema";

import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type FormFieldsProps = {
  form: UseFormReturn<FormType>;
  isPending: boolean;
};

export const FormFields = ({ form, isPending }: FormFieldsProps) => (
  <>
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Tên sự kiện</FormLabel>
          <FormControl>
            <Input
              {...field}
              disabled={isPending}
              placeholder="VD: Khuyến mãi hè"
            />
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
            <Input
              {...field}
              disabled={isPending}
              placeholder="VD: flashSale"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </>
);
