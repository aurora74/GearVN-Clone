import z from "zod";

import { Loader } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { MODAL } from "@/config.global";
import { useAuthModal } from "@/stores/use-auth-modal";
import { useRegister } from "@/react-query/mutation/auth";

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

  fullName: z
    .string()
    .nonempty("Vui lòng nhập họ tên")
    .regex(/^[\p{L} ]+$/u, "Họ tên chỉ được chứa chữ cái và khoảng cách"),

  password: z
    .string()
    .nonempty("Vui lòng nhập mật khẩu")
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
    .regex(/[A-Za-z]/, "Mật khẩu phải chứa ít nhất một chữ cái")
    .regex(/\d/, "Mật khẩu phải chứa ít nhất một số")
    .regex(/[^A-Za-z0-9]/, "Mật khẩu phải chứa ít nhất một ký tự đặc biệt"),
});

export type FormType = z.infer<typeof formSchema>;

export const ModalRegister = () => {
  const { openModal, setModal } = useAuthModal();

  const form = useForm<FormType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      fullName: "",
      password: "",
    },
  });

  const isOpen = openModal === MODAL.REGISTER;

  const handleCloseDialog = () => {
    setModal(null);
    form.reset();
  };

  const { mutate: register, isPending } = useRegister(setModal);

  const onSubmit = (data: FormType) => {
    register(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
      <DialogContent className="space-y-3">
        <DialogHeader>
          <DialogTitle className="text-xl">Đăng ký</DialogTitle>
          <DialogDescription>
            Tạo tài khoản mới bằng cách nhập đầy đủ thông tin bên dưới.
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

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Họ tên</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={isPending}
                      placeholder="Nhập họ tên"
                      className="h-10 rounded-sm"
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
                      disabled={isPending}
                      placeholder="Nhập mật khẩu"
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
              Đăng ký
            </Button>

            <div className="relative py-4">
              <Separator orientation="horizontal" />
              <p className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 text-sm text-gray-500 bg-white px-2 whitespace-nowrap">
                hoặc đăng ký bằng
              </p>
            </div>

            <ButtonLoginGoogle isPending={isPending} />

            <div className="flex  items-center justify-center gap-1 text-[15px]">
              <p>Bạn đã có tài khoản?</p>
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
