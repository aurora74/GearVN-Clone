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
import { Button } from "@/components/ui/button";
import { toastSuccess } from "@/components/ui/toaster";

export const ActionsCell = ({ order }: { order: Order }) => {
  const [openDropdown, setOpenDropdown] = useState(false);
  const { mutate: updateOrderStatus, isPending } = useUpdateOrderStatus();

  const handleCopyId = () => {
    navigator.clipboard.writeText(order._id);
    toastSuccess(
      "Đã sao chép mã đơn hàng",
      "Mã đơn hàng đã được lưu vào clipboard."
    );
    setOpenDropdown(false);
  };

  const handleUpdateStatus = (newStatus: string) => {
    updateOrderStatus(
      { orderId: order._id, status: newStatus },
      { onSuccess: () => setOpenDropdown(false) }
    );
  };

  const availableNext = getNextOrderStatus(order.orderStatus);

  return (
    <DropdownMenu open={openDropdown} onOpenChange={setOpenDropdown}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
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
                  onClick={() => handleUpdateStatus(opt.status)}
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
  );
};
