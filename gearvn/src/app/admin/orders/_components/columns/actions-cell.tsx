import { useState } from "react";

import { MoreVertical, Clipboard } from "lucide-react";

import { cn } from "@/utils/cn";
import { getNextOrderStatus } from "@/utils/get/get-next-order-status";

import { Order } from "@/types/order";
import { useUpdateOrderStatus } from "@/react-query/mutation/order";

import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toastSuccess } from "@/components/ui/toaster";

export const ActionsCell = ({ order }: { order: Order }) => {
  const [openDropdown, setOpenDropdown] = useState(false);
  const [openCancelDialog, setOpenCancelDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const { mutate: updateOrderStatus, isPending } = useUpdateOrderStatus();

  const handleCopyId = () => {
    navigator.clipboard.writeText(order._id);
    toastSuccess(
      "Đã sao chép mã đơn hàng",
      "Mã đơn hàng đã được lưu vào clipboard."
    );
    setOpenDropdown(false);
  };

  const handleUpdateStatus = (newStatus: string, reason?: string) => {
    updateOrderStatus(
      { orderId: order._id, status: newStatus, cancellationReason: reason },
      {
        onSuccess: () => {
          setOpenDropdown(false);
          setOpenCancelDialog(false);
          setCancellationReason("");
        },
      }
    );
  };

  const handleSelectStatus = (newStatus: string) => {
    if (newStatus === "CANCELLED") {
      setOpenDropdown(false);
      setOpenCancelDialog(true);
      return;
    }

    handleUpdateStatus(newStatus);
  };

  const trimmedReason = cancellationReason.trim();
  const availableNext = getNextOrderStatus(order.orderStatus);

  return (
    <>
      <DropdownMenu open={openDropdown} onOpenChange={setOpenDropdown}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Mở thao tác đơn hàng">
            <MoreVertical className="size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            disabled={isPending}
            onClick={handleCopyId}
            className="group hover:!bg-blue-500/10"
          >
            <Clipboard className="size-4 group-hover:text-blue-500" />
            <span className="group-hover:text-blue-500">Copy mã đơn hàng</span>
          </DropdownMenuItem>

          {availableNext.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="text-xs text-muted-foreground px-2 py-1">
                Cập nhật trạng thái
              </div>

              {availableNext.map((opt) => {
                const Icon = opt.icon;

                return (
                  <DropdownMenuItem
                    key={opt.status}
                    disabled={isPending}
                    onClick={() => handleSelectStatus(opt.status)}
                    className={cn("group hover:!font-medium", opt.background)}
                  >
                    <Icon className={cn("size-4", opt.color)} />
                    <span
                      className={cn(
                        "capitalize group-hover:opacity-80",
                        opt.color
                      )}
                    >
                      {opt.label.toLowerCase()}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openCancelDialog} onOpenChange={setOpenCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hủy đơn hàng</DialogTitle>
            <DialogDescription>
              Nhập lý do hủy để xác nhận thao tác này.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={cancellationReason}
            disabled={isPending}
            placeholder="Ví dụ: Khách yêu cầu hủy đơn"
            onChange={(event) => setCancellationReason(event.target.value)}
            className="min-h-28"
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setOpenCancelDialog(false)}
            >
              Đóng
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending || !trimmedReason}
              onClick={() => handleUpdateStatus("CANCELLED", trimmedReason)}
            >
              Hủy đơn hàng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
