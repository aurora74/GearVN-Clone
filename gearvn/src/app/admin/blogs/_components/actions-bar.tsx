"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Plus, MoreHorizontal, Loader } from "lucide-react";
import type { Table as TableType, Column } from "@tanstack/react-table";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import z from "zod";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCreateManager } from "@/react-query/mutation/user";

import { ExportExcelButton } from "../../_components/export-excel-button";
import { ColumnsVisibilityDropdown } from "../../_components/columns-visibility-dropdown";

const createManagerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Vui long nhap ho ten")
    .regex(/^[\p{L} ]+$/u, "Ho ten chi duoc chua chu cai va khoang cach"),
  email: z.string().trim().min(1, "Vui long nhap email").email("Email khong hop le"),
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

type CreateManagerForm = z.infer<typeof createManagerSchema>;

type ActionsBarProps<TData> = {
  data: TData[];
  table: TableType<TData>;
  tableColumns: Column<TData, unknown>[];
};

const CreateManagerDialog = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const form = useForm<CreateManagerForm>({
    resolver: zodResolver(createManagerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      phone: "",
      address: "",
    },
  });

  const { mutate, isPending } = useCreateManager(undefined, {
    onSuccessCallback: () => {
      form.reset();
      setOpen(false);
    },
  });

  const onSubmit = (data: CreateManagerForm) => {
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
          <DialogTitle className="text-xl">Tao Manager</DialogTitle>
          <DialogDescription>
            Tao tai khoan Manager de quan ly cac nhom van hanh.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ho ten</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isPending} placeholder="Nhap ho ten" />
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
                    <Input {...field} disabled={isPending} placeholder="Nhap email" />
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
                  <FormLabel>Mat khau tam thoi</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      disabled={isPending}
                      placeholder="Nhap mat khau tam thoi"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>So dien thoai</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isPending} placeholder="Nhap so dien thoai" />
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
                    <Input {...field} disabled={isPending} placeholder="Nhap dia chi" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                Tao Manager
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export const ActionsBar = <TData,>({
  data,
  table,
  tableColumns,
}: ActionsBarProps<TData>) => {
  return (
    <div className="w-fit flex items-center justify-between sm:justify-end gap-2">
      <div className="hidden sm:flex gap-2">
        <CreateManagerDialog>
          <Button>
            <Plus /> Tao Manager
          </Button>
        </CreateManagerDialog>

        <ExportExcelButton
          data={data}
          fileName="users.xlsx"
          tableColumns={tableColumns}
        />

        <ColumnsVisibilityDropdown table={table} />
      </div>

      <div className="flex sm:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="size-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-3 space-y-3">
            <CreateManagerDialog>
              <Button className="w-full justify-center sm:justify-start">
                <Plus className="mr-2 size-4" /> Tao Manager
              </Button>
            </CreateManagerDialog>

            <ExportExcelButton
              data={data}
              fileName="users.xlsx"
              tableColumns={tableColumns}
            />

            <ColumnsVisibilityDropdown table={table} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
