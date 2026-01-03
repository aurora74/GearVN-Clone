import { UseFormReturn } from "react-hook-form";

import { FormType } from "./form-schema";

import {
  FormItem,
  FormLabel,
  FormField,
  FormControl,
  FormMessage,
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
        name="fullName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Họ và tên</FormLabel>
            <FormControl>
              <Input
                {...field}
                disabled={disabled}
                placeholder="Nhập tên"
                className="rounded-sm"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input
                {...field}
                disabled={disabled}
                placeholder="Nhập email"
                className="rounded-sm"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="password"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Mật khẩu</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="password"
                disabled={disabled}
                placeholder="Nhập mật khẩu"
                className="rounded-sm"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="phone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Số điện thoại</FormLabel>
            <FormControl>
              <Input
                {...field}
                disabled={disabled}
                placeholder="Nhập số điện thoại"
                className="rounded-sm"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="address"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Địa chỉ</FormLabel>
            <FormControl>
              <Input
                {...field}
                disabled={disabled}
                placeholder="Nhập địa chỉ"
                className="rounded-sm"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};
