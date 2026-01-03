"use client";

import { useRouter } from "next/navigation";

import { Loader } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useMe } from "@/react-query/query/user";

import {
  useWards,
  useDistricts,
  useProvinces,
} from "@/hooks/use-vietnam-address";
import { useTotalPrice } from "@/hooks/use-total-price";

import { formatPrice } from "@/utils/format/format-price";
import { buildAddress } from "@/utils/build/build-address";

import { useCartStore } from "@/stores/use-cart-store";
import { useOrderStore } from "@/stores/use-order-store";
import { useCheckoutStepStore } from "@/stores/use-checkout-step";

import { AccountInfo } from "./account-info";
import { NewAddressForm } from "./new-address-form";
import { formSchema, FormType } from "./form-schema";

import {
  Form,
  FormItem,
  FormField,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toastError } from "@/components/ui/toaster";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const OrderInfoStep = () => {
  const router = useRouter();

  const { data: user } = useMe();
  const { items } = useCartStore();
  const { setOrder } = useOrderStore();
  const { setStep } = useCheckoutStepStore();

  const form = useForm<FormType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      note: "",
      ward: "",
      phone: "",
      street: "",
      district: "",
      province: "",
      useAccountInfo: true,
    },
  });

  const { isSubmitting } = form.formState;
  const totalPrice = useTotalPrice(items);

  const [useAccountInfo, province, district] = useWatch({
    control: form.control,
    name: ["useAccountInfo", "province", "district"],
  });

  const { data: provinces = [] } = useProvinces();
  const { data: districts = [] } = useDistricts(province);
  const { data: wards = [] } = useWards(district);

  const onSubmit = (data: FormType) => {
    if (!user) return;

    if (data.useAccountInfo && (!user.phone || !user.address)) {
      toastError(
        "Thông báo",
        "Vui lòng cập nhật số điện thoại và địa chỉ trước khi tiếp tục."
      );
      router.push("/settings/my-profile");
      return;
    }

    const orderItems = items.map((item) => ({
      productId: item.id,
      quantity: item.quantity,
    }));

    const phone: string = data.useAccountInfo
      ? user.phone ?? ""
      : data.phone ?? "";

    const address: string = data.useAccountInfo
      ? user.address ?? ""
      : buildAddress(wards, provinces, districts, data);

    setOrder({
      phone,
      address,
      items: orderItems,
      note: data.note ?? "",
      fullName: user.fullName,
      totalAmount: totalPrice,
    });

    setStep("payment");
  };

  return (
    <Form {...form}>
      <form
        aria-label="Form thông tin đặt hàng"
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
      >
        <FormField
          control={form.control}
          name="useAccountInfo"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base font-semibold">
                Thông tin giao hàng
              </FormLabel>
              <FormControl>
                <RadioGroup
                  disabled={isSubmitting}
                  value={String(field.value)}
                  onValueChange={(val) => field.onChange(val === "true")}
                  className="flex flex-col gap-2"
                >
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="true" />
                    </FormControl>
                    <FormLabel className="text-base font-normal cursor-pointer">
                      Dùng thông tin tài khoản
                    </FormLabel>
                  </FormItem>

                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="false" />
                    </FormControl>
                    <FormLabel className="text-base font-normal cursor-pointer">
                      Nhập thông tin giao hàng mới
                    </FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />

        {useAccountInfo && user ? (
          <AccountInfo
            phone={user.phone}
            address={user.address}
            fullName={user.fullName}
          />
        ) : (
          <NewAddressForm
            provinceCode={province}
            districtCode={district}
            isPending={isSubmitting}
          />
        )}

        <FormField
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ghi chú (tùy chọn)</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  disabled={isSubmitting}
                  placeholder="Nhập ghi chú cho người giao hàng"
                  className="min-h-[100px] text-[15px] rounded-sm"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <div className="pt-6 border-t mt-6 text-right">
            <div className="flex items-center justify-between text-xl font-bold">
              <p>Tổng tiền:</p>
              <p className="text-primary">{formatPrice(totalPrice)}</p>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 flex items-center justify-center gap-2 text-lg mt-4 rounded-sm"
          >
            {isSubmitting && <Loader className="size-4 animate-spin" />}
            Đặt hàng ngay
          </Button>
        </div>
      </form>
    </Form>
  );
};
