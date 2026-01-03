import z from "zod";

import { Loader } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { MODAL } from "@/config.global";
import { useAuthModal } from "@/stores/use-auth-modal";
import { useForgotPassword } from "@/react-query/mutation/auth";

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

const formSchema = z.object({
  email: z.string().nonempty("Vui lòng nhập email").email("Email không hợp lệ"),
});

type FormType = z.infer<typeof formSchema>;

export const ModalForgotPassword = () => {
  const { openModal, setModal } = useAuthModal();

  const form = useForm<FormType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const isOpen = openModal === MODAL["FORGOT-PASSWORD"];

  const handleCloseDialog = () => {
    setModal(null);
    form.reset();
  };

  const { mutate: forgotPassword, isPending } = useForgotPassword(setModal);

  const onSubmit = (data: FormType) => {
    forgotPassword({ email: data.email });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
      <DialogContent className="space-y-3">
        <DialogHeader>
          <DialogTitle className="text-xl">Quên mật khẩu</DialogTitle>
          <DialogDescription>
            Nhập địa chỉ email của bạn để nhận liên kết đặt lại mật khẩu.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={isPending}
                      placeholder="Nhập email"
                      className="h-10 rounded-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              size={"xl"}
              disabled={isPending}
              className="w-full rounded-sm"
            >
              {isPending && <Loader className="size-4.5 animate-spin" />}
              Tiếp tục
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
