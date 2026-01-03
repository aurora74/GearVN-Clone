import z from "zod";

import { Loader } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { MODAL } from "@/config.global";
import { useAuthModal } from "@/stores/use-auth-modal";
import { useResetPassword } from "@/react-query/mutation/auth";

import {
  Form,
  FormItem,
  FormField,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const formSchema = z
  .object({
    newPassword: z
      .string()
      .nonempty("Vui lòng nhập mật khẩu")
      .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
      .regex(/[A-Za-z]/, "Mật khẩu phải chứa ít nhất một chữ cái")
      .regex(/\d/, "Mật khẩu phải chứa ít nhất một số")
      .regex(/[^A-Za-z0-9]/, "Mật khẩu phải chứa ít nhất một ký tự đặc biệt"),

    confirmNewPassword: z.string().nonempty("Vui lòng xác nhận mật khẩu"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmNewPassword"],
  });

type FormType = z.infer<typeof formSchema>;

export const ModalResetPassword = () => {
  const { openModal, setModal, resetToken } = useAuthModal();

  const form = useForm<FormType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const isOpen = openModal === MODAL["RESET-PASSWORD"];

  const handleCloseDialog = () => {
    setModal(null);
    form.reset();
  };

  const { mutate: resetPassword, isPending } = useResetPassword(setModal);

  const onSubmit = (data: FormType) => {
    if (!resetToken) return;

    resetPassword({
      token: resetToken,
      newPassword: data.newPassword,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
      <DialogContent className="space-y-3">
        <DialogHeader>
          <DialogTitle className="text-xl">Đặt lại mật khẩu</DialogTitle>
          <DialogDescription>
            Nhập mật khẩu mới để cập nhật lại thông tin đăng nhập của bạn.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mật khẩu mới</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      disabled={isPending}
                      placeholder="Nhập mật khẩu mới"
                      className="h-10 rounded-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmNewPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nhập lại mật khẩu mới</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      disabled={isPending}
                      placeholder="Nhập lại mật khẩu mới"
                      className="h-10 rounded-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              disabled={isPending}
              type="submit"
              size={"xl"}
              className="w-full rounded-sm"
            >
              {isPending && <Loader className="size-4.5 animate-spin" />}
              Đặt lại mật khẩu
            </Button>

            <div className="flex  items-center justify-center gap-1 text-[15px]">
              <p>Đã nhớ mật khẩu?</p>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setModal("login")}
                className="text-primary hover:underline disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                Đăng nhập ngay!
              </button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
