import z from "zod";

import { Loader } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { MODAL } from "@/config.global";
import { useLogin } from "@/react-query/mutation/auth";
import { useAuthModal } from "@/stores/use-auth-modal";

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
import { Separator } from "@/components/ui/separator";
import { ButtonLoginGoogle } from "@/components/global/auth/button-login-google";

const formSchema = z.object({
  email: z.string().nonempty("Vui lòng nhập email").email("Email không hợp lệ"),
  password: z.string().nonempty("Vui lòng nhập mật khẩu"),
});

type FormType = z.infer<typeof formSchema>;

export const ModalLogin = () => {
  const { openModal, setModal } = useAuthModal();

  const form = useForm<FormType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const isOpen = openModal === MODAL.LOGIN;

  const handleCloseDialog = () => {
    setModal(null);
    form.reset();
  };

  const { mutate: login, isPending } = useLogin(handleCloseDialog, setModal);

  const onSubmit = (data: FormType) => {
    login(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
      <DialogContent className="space-y-3">
        <DialogHeader>
          <DialogTitle className="text-xl">Đăng nhập</DialogTitle>
          <DialogDescription>
            Nhập email và mật khẩu để truy cập vào tài khoản của bạn.
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

            <div className="flex flex-col gap-1">
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
                        disabled={isPending}
                        placeholder="Nhập mật khẩu"
                        className="h-10 rounded-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <button
                type="button"
                disabled={isPending}
                onClick={() => setModal("forgot-password")}
                className="text-sm hover:text-primary hover:underline disabled:opacity-50 disabled:pointer-events-none ml-auto cursor-pointer"
              >
                Quên mật khẩu?
              </button>
            </div>

            <Button
              size={"xl"}
              type="submit"
              disabled={isPending}
              className="w-full rounded-sm"
            >
              {isPending && <Loader className="size-4.5 animate-spin" />}
              Đăng nhập
            </Button>

            <div className="relative py-4">
              <Separator orientation="horizontal" />
              <p className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 text-sm text-gray-500 bg-white px-2 whitespace-nowrap">
                hoặc đăng nhập bằng
              </p>
            </div>

            <ButtonLoginGoogle isPending={isPending} />

            <div className="flex  items-center justify-center gap-1 text-[15px]">
              <p>Bạn chưa có tài khoản?</p>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setModal("register")}
                className="text-primary hover:underline disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                Đăng ký ngay!
              </button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
