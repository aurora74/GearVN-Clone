import type { ReactNode } from "react";
import { useState } from "react";

import { MoreVertical, Clipboard, Trash2, Ban, Loader } from "lucide-react";

import { User } from "@/types/user";
import { ACCOUNT_STATUS } from "@/config.global";

import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toastSuccess } from "@/components/ui/toaster";
import {
  useDeleteAccount,
  useUpdateAccountStatus,
} from "@/react-query/mutation/user";

type ReasonDialogProps = {
  user: User;
  title: string;
  description: string;
  submitLabel: string;
  children: ReactNode;
  setOpenDropdown: (open: boolean) => void;
  onSubmit: (reason: string) => void;
  isPending: boolean;
};

const ReasonDialog = ({
  user,
  title,
  description,
  submitLabel,
  children,
  setOpenDropdown,
  onSubmit,
  isPending,
}: ReasonDialogProps) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const trimmedReason = reason.trim();

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setReason("");
  };

  const handleSubmit = () => {
    if (!trimmedReason) return;
    onSubmit(trimmedReason);
    setOpen(false);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl text-destructive">{title}</DialogTitle>
          <DialogDescription>
            {description} <span className="font-semibold text-black">{user.fullName || user.email}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor={`reason-${user._id}`}>
            Lý do
          </label>
          <Textarea
            id={`reason-${user._id}`}
            value={reason}
            disabled={isPending}
            placeholder="Nhập lý do để ghi nhận vào audit log."
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        <DialogFooter className="flex justify-end gap-3 mt-4">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              setOpen(false);
              setOpenDropdown(false);
            }}
          >
            Huy
          </Button>
          <Button
            variant="destructive"
            disabled={isPending || !trimmedReason}
            onClick={handleSubmit}
          >
            {isPending && <Loader className="size-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ActionsCell = ({ user }: { user: User }) => {
  const [openDropdown, setOpenDropdown] = useState(false);
  const { mutate: updateStatus, isPending: isUpdatingStatus } =
    useUpdateAccountStatus(() => {
      setOpenDropdown(false);
    });
  const { mutate: deleteAccount, isPending: isDeletingAccount } =
    useDeleteAccount(() => {
      setOpenDropdown(false);
    });

  const handleCopyId = () => {
    navigator.clipboard.writeText(user._id);
    toastSuccess("Da sao chep ID", "Ma nguoi dung da duoc luu vao clipboard.");
    setOpenDropdown(false);
  };

  return (
    <DropdownMenu open={openDropdown} onOpenChange={setOpenDropdown}>
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

        <DropdownMenuSeparator />

        {user.status !== ACCOUNT_STATUS.BANNED && (
          <ReasonDialog
            user={user}
            title="Khóa tài khoản"
            description="Khóa tài khoản: thao tác này ngăn người dùng đăng nhập vào hệ thống"
            submitLabel="Khóa tài khoản"
            setOpenDropdown={setOpenDropdown}
            isPending={isUpdatingStatus}
            onSubmit={(reason) =>
              updateStatus({ userId: user._id, status: ACCOUNT_STATUS.BANNED, reason })
            }
          >
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => e.preventDefault()}
              className="group hover:!bg-red-500/10"
            >
              <Ban className="size-4 group-hover:text-red-500" />
              <p className="group-hover:text-red-500">Khóa tài khoản</p>
            </DropdownMenuItem>
          </ReasonDialog>
        )}

        <ReasonDialog
          user={user}
          title="Xóa tài khoản"
          description="Xóa tài khoản: thao tác này không thể hoàn tác với"
          submitLabel="Xóa tài khoản"
          setOpenDropdown={setOpenDropdown}
          isPending={isDeletingAccount}
          onSubmit={(reason) => deleteAccount({ userId: user._id, reason })}
        >
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => e.preventDefault()}
            className="group"
          >
            <Trash2 className="size-4 group-hover:text-red-500" />
            <p className="group-hover:text-red-500">Xóa tài khoản</p>
          </DropdownMenuItem>
        </ReasonDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
