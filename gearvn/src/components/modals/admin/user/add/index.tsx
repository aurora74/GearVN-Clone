"use client";

import { useState } from "react";
import { Loader } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { formSchema, FormType } from "./form-schema";
import { useCreateUser } from "@/react-query/mutation/user";

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

export const ModalAddUser = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);

  const form = useForm<FormType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      phone: "",
      address: "",
      fullName: "",
      password: "",
    },
  });

  const { mutate, isPending } = useCreateUser(() => {
    setOpen(false);
    form.reset();
  });

  const onSubmit = (data: FormType) => {
    mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl">Thêm người dùng mới</DialogTitle>
          <DialogDescription>
            Nhập thông tin người dùng để tạo mới tài khoản.
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
                Thêm người dùng
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
