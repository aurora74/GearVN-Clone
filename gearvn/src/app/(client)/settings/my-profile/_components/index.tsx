"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Loader } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  useWards,
  useProvinces,
  useDistricts,
} from "@/hooks/use-vietnam-address";
import { formSchema, FormType } from "./form-schema";
import { buildAddress } from "@/utils/build/build-address";

import { useMe } from "@/react-query/query/user";
import { useEditUser } from "@/react-query/mutation/user";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormLabel } from "@/components/ui/form";

import { InputField } from "./input-field";
import { Sidebar } from "../../_components/sidebar";
import { FormFieldAddress } from "./form-field-address";
import { Breadcrumbs } from "@/components/global/breadcrumbs";
import { ProfileFormSkeleton } from "./profile-form-skeleton";

const breadcrumbs = [
  { label: "Trang chủ", href: "/" },
  { label: "Hồ sơ của tôi", href: "/settings/my-profile" },
];

export const MyProfilePage = () => {
  const router = useRouter();
  const [isFormReady, setIsFormReady] = useState(false);

  const { data: user } = useMe();
  const { mutate: editUser, isPending } = useEditUser();

  const form = useForm<FormType>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      phone: "",
      fullName: "",
      ward: "",
      street: "",
      province: "",
      district: "",
    },
  });

  const provinceCode = useWatch({ control: form.control, name: "province" });
  const districtCode = useWatch({ control: form.control, name: "district" });

  const { data: provinces = [], isPending: isProvincesPending } =
    useProvinces();

  const { data: districts = [], isPending: isDistrictsPending } =
    useDistricts(provinceCode);

  const { data: wards = [], isPending: isWardsPending } =
    useWards(districtCode);

  useEffect(() => {
    if (!user || !provinces.length || isFormReady) return;

    const addressParts = user.address?.split(",").map((s) => s.trim()) || [];
    const [street, , , provinceName] = addressParts;

    const province = provinces.find((p) => p.name === provinceName);
    const provinceCode = String(province?.code || "");

    form.reset({
      fullName: user.fullName || "",
      phone: user.phone || "",
      street: street || "",
      province: provinceCode,
      district: "",
      ward: "",
    });

    setIsFormReady(true);
  }, [user, provinces, form, isFormReady]);

  useEffect(() => {
    if (!isFormReady || !districts.length || !user?.address) return;

    const addressParts = user.address.split(",").map((s) => s.trim());
    const districtName = addressParts[2];

    if (!districtName) return;

    const district = districts.find((d) => d.name === districtName);
    const currentDistrict = form.getValues("district");

    if (district && !currentDistrict) {
      form.setValue("district", String(district.code), {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
  }, [districts, isFormReady, user?.address, form]);

  useEffect(() => {
    if (!isFormReady || !wards.length || !user?.address) return;

    const addressParts = user.address.split(",").map((s) => s.trim());
    const wardName = addressParts[1];

    if (!wardName) return;

    const ward = wards.find((w) => w.name === wardName);
    const currentWard = form.getValues("ward");

    if (ward && !currentWard) {
      form.setValue("ward", String(ward.code), {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
  }, [wards, isFormReady, user?.address, form]);

  useEffect(() => {
    if (!isFormReady) return;

    const currentDistrict = form.getValues("district");
    const currentWard = form.getValues("ward");

    if (currentDistrict || currentWard) {
      form.setValue("district", "", {
        shouldValidate: false,
        shouldDirty: true,
      });
      form.setValue("ward", "", {
        shouldValidate: false,
        shouldDirty: true,
      });

      form.clearErrors(["district", "ward"]);
    }
  }, [provinceCode, form, isFormReady]);

  useEffect(() => {
    if (!isFormReady) return;

    const currentWard = form.getValues("ward");

    if (currentWard) {
      form.setValue("ward", "", {
        shouldValidate: false,
        shouldDirty: true,
      });

      form.clearErrors("ward");
    }
  }, [districtCode, form, isFormReady]);

  const onSubmit = (data: FormType) => {
    if (!user) return;

    const address = buildAddress(wards, provinces, districts, data);
    editUser({
      id: user._id,
      address,
      phone: data.phone,
      fullName: data.fullName,
    });
  };

  return (
    <>
      <Breadcrumbs items={breadcrumbs} />

      <div className="wrapper w-full flex flex-col lg:flex-row gap-6 pt-3 pb-16">
        <Sidebar />

        {!isFormReady ? (
          <ProfileFormSkeleton />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1">
              <div className="w-full space-y-6 p-4 border bg-white shadow-sm rounded-lg">
                <h2 className="text-xl font-semibold mb-6">
                  Thông tin tài khoản
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <InputField
                    label="Họ tên"
                    name="fullName"
                    control={form.control}
                    isPending={isPending}
                    placeholder="Nhập họ tên"
                  />
                  <div className="space-y-2">
                    <FormLabel>Email</FormLabel>
                    <Input readOnly disabled value={user?.email} />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <InputField
                    name="phone"
                    label="Số điện thoại"
                    isPending={isPending}
                    control={form.control}
                    placeholder="Nhập số điện thoại"
                  />
                  <InputField
                    name="street"
                    label="Tên đường"
                    isPending={isPending}
                    control={form.control}
                    placeholder="Nhập tên đường"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <FormFieldAddress
                    name="province"
                    options={provinces}
                    control={form.control}
                    label="Tỉnh / Thành phố"
                    placeholder="Chọn tỉnh / thành phố"
                    disabled={
                      isPending || isProvincesPending || provinces.length === 0
                    }
                  />
                  <FormFieldAddress
                    name="district"
                    options={districts}
                    label="Quận / Huyện"
                    control={form.control}
                    placeholder="Chọn quận / huyện"
                    disabled={
                      !provinceCode ||
                      isPending ||
                      isDistrictsPending ||
                      districts.length === 0
                    }
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <FormFieldAddress
                    name="ward"
                    options={wards}
                    label="Phường / Xã"
                    control={form.control}
                    placeholder="Chọn phường / xã"
                    disabled={
                      !districtCode ||
                      isPending ||
                      isWardsPending ||
                      wards.length === 0
                    }
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => router.push("/")}
                  >
                    Về trang chủ
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending && <Loader className="size-4 animate-spin" />}
                    Cập nhật hồ sơ
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        )}
      </div>
    </>
  );
};
