"use client";

import { useState } from "react";

import { ColumnDef } from "@tanstack/react-table";
import { Edit, MoreHorizontal, Power, Trash, PackagePlus } from "lucide-react";

import {
  useDeleteEvent,
  useDisableEvent,
  useEnableEvent,
  useEndEvent,
} from "@/react-query/mutation/event";
import { EventType } from "@/types/event";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FlashSaleForm } from "@/components/modals/admin/promotions/flash-sale-form";
import { FlashSaleProductsForm } from "@/components/modals/admin/promotions/flash-sale-products-form";
import {
  ConfirmPromotionAction,
  FLASH_SALE_END_CONFIRMATION,
  IRREVERSIBLE_CONFIRMATION,
} from "@/components/modals/admin/promotions/confirm-promotion-action";

import { FlashSaleStatusBadge } from "../status-badge";

const formatDateTime = (value?: string) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "-";

const FlashSaleActionsCell = ({ event }: { event: EventType }) => {
  const [openDropdown, setOpenDropdown] = useState(false);
  const { mutate: enableEvent, isPending: isEnabling } = useEnableEvent(() =>
    setOpenDropdown(false)
  );
  const { mutate: disableEvent, isPending: isDisabling } = useDisableEvent(() =>
    setOpenDropdown(false)
  );
  const { mutate: endEvent, isPending: isEnding } = useEndEvent(() =>
    setOpenDropdown(false)
  );
  const { mutate: deleteEvent, isPending: isDeleting } = useDeleteEvent(() =>
    setOpenDropdown(false)
  );

  const isEnabled = event.status !== "disabled";

  return (
    <DropdownMenu open={openDropdown} onOpenChange={setOpenDropdown}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="MoreHorizontal - mở hành động flash sale"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <FlashSaleForm event={event} onOpenChange={setOpenDropdown}>
          <DropdownMenuItem
            aria-label="Edit flash sale"
            onSelect={(selectEvent) => selectEvent.preventDefault()}
          >
            <Edit className="size-4" />
            Sửa flash sale
          </DropdownMenuItem>
        </FlashSaleForm>
        <FlashSaleProductsForm event={event} onOpenChange={setOpenDropdown}>
          <DropdownMenuItem onSelect={(selectEvent) => selectEvent.preventDefault()}>
            <PackagePlus className="size-4" />
            Sản phẩm flash sale
          </DropdownMenuItem>
        </FlashSaleProductsForm>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          aria-label="Power flash sale"
          disabled={isEnabling || isDisabling}
          onClick={() =>
            isEnabled
              ? disableEvent({ id: event._id, reason: "Tắt từ màn hình khuyến mãi" })
              : enableEvent({ id: event._id, reason: "Bật từ màn hình khuyến mãi" })
          }
        >
          <Power className="size-4" />
          {isEnabled ? "Tắt" : "Bật"}
        </DropdownMenuItem>
        <ConfirmPromotionAction
          title="Kết thúc flash sale"
          description={FLASH_SALE_END_CONFIRMATION}
          confirmLabel="Kết thúc"
          isPending={isEnding}
          onClose={() => setOpenDropdown(false)}
          onConfirm={(reason) => endEvent({ id: event._id, reason })}
        >
          <DropdownMenuItem
            aria-label="Power kết thúc flash sale"
            onSelect={(selectEvent) => selectEvent.preventDefault()}
          >
            <Power className="size-4" />
            Kết thúc
          </DropdownMenuItem>
        </ConfirmPromotionAction>
        <ConfirmPromotionAction
          title="Xoá flash sale"
          description={IRREVERSIBLE_CONFIRMATION}
          confirmLabel="Xoá"
          isPending={isDeleting}
          onClose={() => setOpenDropdown(false)}
          onConfirm={(reason) => deleteEvent({ id: event._id, reason })}
        >
          <DropdownMenuItem
            aria-label="Trash flash sale"
            variant="destructive"
            onSelect={(selectEvent) => selectEvent.preventDefault()}
          >
            <Trash className="size-4" />
            Xoá
          </DropdownMenuItem>
        </ConfirmPromotionAction>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const flashSaleColumns: ColumnDef<EventType>[] = [
  {
    accessorKey: "name",
    header: () => <span>Tên flash sale</span>,
    cell: ({ row }) => <span className="font-semibold">{row.original.name}</span>,
  },
  {
    accessorKey: "tag",
    header: () => <span>Tag sự kiện</span>,
    cell: ({ row }) => <span className="uppercase">{row.original.tag}</span>,
  },
  {
    accessorKey: "status",
    header: () => <span>Trạng thái</span>,
    cell: ({ row }) => <FlashSaleStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "startsAt",
    header: () => <span>Bắt đầu</span>,
    cell: ({ row }) => formatDateTime(row.original.startsAt),
  },
  {
    accessorKey: "endsAt",
    header: () => <span>Kết thúc</span>,
    cell: ({ row }) => formatDateTime(row.original.endsAt),
  },
  {
    id: "actions",
    cell: ({ row }) => <FlashSaleActionsCell event={row.original} />,
  },
];
