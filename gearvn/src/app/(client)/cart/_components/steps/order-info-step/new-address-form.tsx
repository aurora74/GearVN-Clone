"use client";

import { useFormContext, UseFormSetValue } from "react-hook-form";

import {
  useWards,
  useProvinces,
  useDistricts,
} from "@/hooks/use-vietnam-address";
import { AddressFormValues } from "@/types/order";
import { getAddressSelect } from "@/utils/get/get-address-select";

import {
  FormItem,
  FormField,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectItem,
  SelectValue,
  SelectContent,
  SelectTrigger,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type NewAddressFormProps = {
  isPending: boolean;
  provinceCode?: string;
  districtCode?: string;
};

export const NewAddressForm = ({
  isPending,
  provinceCode,
  districtCode,
}: NewAddressFormProps) => {
  const { control, setValue } = useFormContext<AddressFormValues>();

  const { data: districts, isPending: districtsPending } =
    useDistricts(provinceCode);
  const { data: provinces, isPending: provincesPending } = useProvinces();
  const { data: wards, isPending: wardsPending } = useWards(districtCode);

  const ADDRESS_SELECT = getAddressSelect(
    wards,
    provinces,
    districts,
    wardsPending,
    provincesPending,
    districtsPending,
    provinceCode,
    districtCode
  );

  const handleAddressChange = (
    val: string,
    name: string,
    fieldOnChange: (val: string) => void,
    setValue: UseFormSetValue<AddressFormValues>
  ) => {
    fieldOnChange(val);

    if (name === "province") {
      setValue("district", "");
      setValue("ward", "");
    }

    if (name === "district") {
      setValue("ward", "");
    }
  };

  return (
    <>
      <FormField
        name="phone"
        control={control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Số điện thoại</FormLabel>
            <FormControl>
              <Input
                {...field}
                disabled={isPending}
                placeholder="Nhập số điện thoại"
                className="h-11 text-[15px] rounded-sm"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="street"
        control={control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tên đường</FormLabel>
            <FormControl>
              <Input
                {...field}
                disabled={isPending}
                placeholder="Nhập tên đường"
                className="h-11 text-[15px] rounded-sm"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {ADDRESS_SELECT.map(({ name, label, options, loading, disabled }) => (
        <FormField
          key={name}
          control={control}
          name={name as keyof AddressFormValues}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{label}</FormLabel>
              <Select
                value={field.value}
                disabled={isPending || disabled || loading}
                onValueChange={(val) =>
                  handleAddressChange(val, name, field.onChange, setValue)
                }
              >
                <FormControl>
                  <SelectTrigger className="!h-11 text-[15px] rounded-sm">
                    <SelectValue placeholder={`Chọn ${label}`} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {options?.map((option) => (
                    <SelectItem
                      key={option.code}
                      value={String(option.code)}
                      className="text-[15px]"
                    >
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
    </>
  );
};
