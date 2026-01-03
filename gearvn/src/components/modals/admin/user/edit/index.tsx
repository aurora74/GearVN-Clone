"use client";

import { useState } from "react";

import { Loader } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { User } from "@/types/user";
import { formSchema, FormType } from "./form-schema";
import { useEditUser } from "@/react-query/mutation/user";

import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogFooter,
  DialogContent,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

import { FormFields } from "./form-fields";

type ModalEditUserProps = {
  user: User;
  children: React.ReactNode;
  setOpenDropdown: (open: boolean) => void;
};

export const ModalEditUser = ({
  user,
  children,
  setOpenDropdown,
}: ModalEditUserProps) => {
  const [open, setOpen] = useState(false);

  const form = useForm<FormType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: user.email,
      phone: user.phone,
      address: user.address,
      fullName: user.fullName,
    },
  });

  const { mutate, isPending } = useEditUser(() => {
    form.reset();
    setOpen(false);
    setOpenDropdown(false);
  });

  const onSubmit = (values: FormType) => {
    mutate({ id: user._id, ...values });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl">Chỉnh sửa người dùng</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin người dùng của bạn tại đây.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormFields form={form} disabled={isPending} />

            <DialogFooter className="flex justify-end gap-3 mt-4">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setOpen(false)}
              >
                Huỷ
              </Button>

              <Button type="submit" size="lg" disabled={isPending}>
                {isPending && <Loader className="size-4 animate-spin" />}
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
