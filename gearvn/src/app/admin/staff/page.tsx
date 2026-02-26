"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Clipboard, Loader, MoreVertical, Pencil, Plus, Ban } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import z from "zod";

import { ACCOUNT_STATUS, USER_ROLE } from "@/config.global";
import { useStaffUsers } from "@/react-query/query/user";
import {
  useCreateStaff,
  useUpdateAccountStatus,
  useUpdateStaff,
} from "@/react-query/mutation/user";
import type { User } from "@/types/user";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toastSuccess } from "@/components/ui/toaster";
import { cn } from "@/utils/cn";
import { getAccountStatusUI } from "@/utils/get/get-account-status-ui";

const staffRoleOptions = [
  { value: USER_ROLE.PRODUCT_MARKETING_STAFF, label: "Product & Marketing" },
  { value: USER_ROLE.SALES_OPERATIONS_STAFF, label: "Sales & Operations" },
  { value: USER_ROLE.CSR, label: "CSR" },
] as const;

type StaffRole = (typeof staffRoleOptions)[number]["value"];

const staffRoleValues = staffRoleOptions.map((role) => role.value) as [
  StaffRole,
  ...StaffRole[]
];

const staffRoleLabels: Record<StaffRole, string> = {
  PRODUCT_MARKETING_STAFF: "Product & Marketing",
  SALES_OPERATIONS_STAFF: "Sales & Operations",
  CSR: "CSR",
};

const staffRoleClassNames: Record<StaffRole, string> = {
  PRODUCT_MARKETING_STAFF: "bg-blue-50 text-blue-700 border-blue-200",
  SALES_OPERATIONS_STAFF: "bg-amber-50 text-amber-700 border-amber-200",
  CSR: "bg-green-50 text-green-700 border-green-200",
};

const staffFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Vui long nhap ho ten")
    .regex(/^[\p{L} ]+$/u, "Ho ten chi duoc chua chu cai va khoang cach"),
  email: z.string().trim().min(1, "Vui long nhap email").email("Email khong hop le"),
  role: z.enum(staffRoleValues),
  password: z.string().min(6, "Mat khau phai co it nhat 6 ky tu"),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^0\d{9,10}$/.test(val), {
      message: "So dien thoai khong hop le",
    }),
  address: z.string().trim().optional(),
});

const editStaffFormSchema = staffFormSchema.omit({ password: true });

type StaffForm = z.infer<typeof staffFormSchema>;
type EditStaffForm = z.infer<typeof editStaffFormSchema>;
type StaffUser = User & { role: StaffRole };

const isStaffUser = (user: User): user is StaffUser =>
  staffRoleOptions.some((option) => option.value === user.role);

const StaffRoleBadge = ({ role }: { role: StaffRole }) => (
  <Badge
    variant="outline"
    className={cn("whitespace-nowrap px-2", staffRoleClassNames[role])}
  >
    {staffRoleLabels[role]}
  </Badge>
);

const StatusBadge = ({ user }: { user: User }) => {
  const { icon: Icon, label, className } = getAccountStatusUI(user.status);

  return (
    <Badge variant="outline" className="flex items-center gap-1 px-2 whitespace-nowrap">
      <Icon className={cn("size-4", className)} />
      {label}
    </Badge>
  );
};

const StaffFormFields = ({
  form,
  disabled,
  includePassword,
}: {
  form: any;
  disabled: boolean;
  includePassword: boolean;
}) => (
  <>
    <FormField
      control={form.control}
      name="fullName"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Ho ten</FormLabel>
          <FormControl>
            <Input {...field} disabled={disabled} placeholder="Nhap ho ten" />
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
            <Input {...field} disabled={disabled} placeholder="Nhap email" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <FormField
      control={form.control}
      name="role"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Vai tro</FormLabel>
          <Select
            value={field.value}
            disabled={disabled}
            onValueChange={field.onChange}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Chon vai tro" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {staffRoleOptions.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
    {includePassword && (
      <FormField
        control={form.control}
        name="password"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Mat khau tam thoi</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="password"
                disabled={disabled}
                placeholder="Nhap mat khau tam thoi"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    )}
    <FormField
      control={form.control}
      name="phone"
      render={({ field }) => (
        <FormItem>
          <FormLabel>So dien thoai</FormLabel>
          <FormControl>
            <Input {...field} disabled={disabled} placeholder="Nhap so dien thoai" />
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
          <FormLabel>Dia chi</FormLabel>
          <FormControl>
            <Input {...field} disabled={disabled} placeholder="Nhap dia chi" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </>
);

const CreateStaffDialog = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const form = useForm<StaffForm>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      role: USER_ROLE.PRODUCT_MARKETING_STAFF,
      password: "",
      phone: "",
      address: "",
    },
  });

  const { mutate, isPending } = useCreateStaff(undefined, {
    onSuccessCallback: () => {
      form.reset();
      setOpen(false);
    },
  });

  const onSubmit = (data: StaffForm) => {
    mutate({
      ...data,
      phone: data.phone || undefined,
      address: data.address || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl">Tao nhan su</DialogTitle>
          <DialogDescription>
            Tao tai khoan nhan su cho cac vai tro van hanh.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <StaffFormFields form={form} disabled={isPending} includePassword />
            <DialogFooter className="flex justify-end gap-3 mt-4">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setOpen(false)}
              >
                Huy
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader className="size-4 animate-spin" />}
                Tao nhan su
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const EditStaffDialog = ({
  user,
  children,
  setOpenDropdown,
}: {
  user: User;
  children: ReactNode;
  setOpenDropdown: (open: boolean) => void;
}) => {
  const [open, setOpen] = useState(false);
  const form = useForm<EditStaffForm>({
    resolver: zodResolver(editStaffFormSchema),
    defaultValues: {
      fullName: user.fullName,
      email: user.email,
      role: isStaffUser(user) ? user.role : USER_ROLE.PRODUCT_MARKETING_STAFF,
      phone: user.phone ?? "",
      address: user.address ?? "",
    },
  });

  const { mutate, isPending } = useUpdateStaff(undefined, {
    onSuccessCallback: () => {
      setOpen(false);
      setOpenDropdown(false);
    },
  });

  const onSubmit = (data: EditStaffForm) => {
    mutate({
      id: user._id,
      ...data,
      phone: data.phone || undefined,
      address: data.address || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl">Sua thong tin</DialogTitle>
          <DialogDescription>Cap nhat thong tin va vai tro nhan su.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <StaffFormFields form={form} disabled={isPending} includePassword={false} />
            <DialogFooter className="flex justify-end gap-3 mt-4">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setOpen(false)}
              >
                Huy
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader className="size-4 animate-spin" />}
                Luu thay doi
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const DeactivateStaffDialog = ({
  user,
  children,
  setOpenDropdown,
}: {
  user: User;
  children: ReactNode;
  setOpenDropdown: (open: boolean) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const trimmedReason = reason.trim();
  const { mutate, isPending } = useUpdateAccountStatus(undefined, {
    onSuccessCallback: () => {
      setOpen(false);
      setOpenDropdown(false);
      setReason("");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl text-destructive">Vo hieu hoa</DialogTitle>
          <DialogDescription>
            Vo hieu hoa tai khoan cua{" "}
            <span className="font-semibold text-black">{user.fullName || user.email}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor={`staff-reason-${user._id}`}>
            Ly do
          </label>
          <Textarea
            id={`staff-reason-${user._id}`}
            value={reason}
            disabled={isPending}
            placeholder="Nhap ly do de ghi nhan vao audit log."
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <DialogFooter className="flex justify-end gap-3 mt-4">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setOpen(false)}
          >
            Huy
          </Button>
          <Button
            variant="destructive"
            disabled={isPending || !trimmedReason}
            onClick={() =>
              mutate({
                userId: user._id,
                status: ACCOUNT_STATUS.BANNED,
                reason: trimmedReason,
              })
            }
          >
            {isPending && <Loader className="size-4 animate-spin" />}
            Vo hieu hoa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const StaffActions = ({ user }: { user: User }) => {
  const [open, setOpen] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(user._id);
    toastSuccess("Da sao chep ID", "Ma nhan su da duoc luu vao clipboard.");
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCopyId} className="group">
          <Clipboard className="size-4 group-hover:text-blue-500" />
          <p className="group-hover:text-blue-500">Copy ID</p>
        </DropdownMenuItem>
        <EditStaffDialog user={user} setOpenDropdown={setOpen}>
          <DropdownMenuItem
            onSelect={(event) => event.preventDefault()}
            className="group hover:!bg-blue-500/10"
          >
            <Pencil className="size-4 group-hover:text-blue-500" />
            <p className="group-hover:text-blue-500">Sua thong tin</p>
          </DropdownMenuItem>
        </EditStaffDialog>
        <DropdownMenuSeparator />
        {user.status !== ACCOUNT_STATUS.BANNED && (
          <DeactivateStaffDialog user={user} setOpenDropdown={setOpen}>
            <DropdownMenuItem
              variant="destructive"
              onSelect={(event) => event.preventDefault()}
              className="group hover:!bg-red-500/10"
            >
              <Ban className="size-4 group-hover:text-red-500" />
              <p className="group-hover:text-red-500">Vo hieu hoa</p>
            </DropdownMenuItem>
          </DeactivateStaffDialog>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default function StaffPage() {
  const { data: users, isPending } = useStaffUsers({
    page: 1,
    limit: 100,
    sortBy: "-createdAt",
  });

  const staff = (users?.data ?? []) as StaffUser[];

  return (
    <div className="h-full p-4 space-y-4 border bg-white shadow-sm rounded-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Nhan su</h1>
          <p className="text-sm text-muted-foreground">({staff.length} nhan su)</p>
        </div>
        <CreateStaffDialog>
          <Button className="w-full sm:w-auto">
            <Plus className="size-4" />
            Tao nhan su
          </Button>
        </CreateStaffDialog>
      </div>

      <div className="overflow-x-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ho ten</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Vai tro</TableHead>
              <TableHead>Trang thai</TableHead>
              <TableHead>Ngay tao</TableHead>
              <TableHead className="text-right">Thao tac</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Dang tai nhan su...
                </TableCell>
              </TableRow>
            ) : staff.length ? (
              staff.map((user) => (
                <TableRow key={user._id}>
                  <TableCell className="font-medium">{user.fullName || "Chua cap nhat"}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <StaffRoleBadge role={user.role} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge user={user} />
                  </TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleString("vi-VN", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <StaffActions user={user} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="space-y-1">
                    <p className="font-medium">Chua co nhan su</p>
                    <p className="text-sm text-muted-foreground">
                      Tao nhan su dau tien de phan quyen van hanh.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
