"use client";

import { useState } from "react";

import { ColumnDef } from "@tanstack/react-table";
import { Edit, MoreHorizontal, Power, Trash } from "lucide-react";

import {
  useDeleteVoucher,
  useDisableVoucher,
  useEnableVoucher,
} from "@/react-query/mutation/voucher";
import { VoucherType } from "@/types/voucher";
import { formatPrice } from "@/utils/format/format-price";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VoucherForm } from "@/components/modals/admin/promotions/voucher-form";
import {
  ConfirmPromotionAction,
  IRREVERSIBLE_CONFIRMATION,
  VOUCHER_DISABLE_CONFIRMATION,
} from "@/components/modals/admin/promotions/confirm-promotion-action";

import { VoucherStatusBadge } from "../status-badge";

const VoucherActionsCell = ({ voucher }: { voucher: VoucherType }) => {
  const [openDropdown, setOpenDropdown] = useState(false);
  const { mutate: enableVoucher, isPending: isEnabling } = useEnableVoucher(() =>
    setOpenDropdown(false)
  );
  const { mutate: disableVoucher, isPending: isDisabling } = useDisableVoucher(() =>
    setOpenDropdown(false)
  );
  const { mutate: deleteVoucher, isPending: isDeleting } = useDeleteVoucher(() =>
    setOpenDropdown(false)
  );

  const voucherId = voucher._id ?? "";
  const isEnabled = voucher.status !== "disabled";

  return (
    <DropdownMenu open={openDropdown} onOpenChange={setOpenDropdown}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="MoreHorizontal - mở hành động voucher"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <VoucherForm voucher={voucher} onOpenChange={setOpenDropdown}>
          <DropdownMenuItem
            aria-label="Edit voucher"
            onSelect={(selectEvent) => selectEvent.preventDefault()}
          >
            <Edit className="size-4" />
            Sửa voucher
          </DropdownMenuItem>
        </VoucherForm>
        <DropdownMenuSeparator />
        <ConfirmPromotionAction
          title={isEnabled ? "Tắt voucher" : "Bật voucher"}
          description={VOUCHER_DISABLE_CONFIRMATION}
          confirmLabel={isEnabled ? "Tắt" : "Bật"}
          isPending={isEnabling || isDisabling}
          onClose={() => setOpenDropdown(false)}
          onConfirm={(reason) =>
            isEnabled
              ? disableVoucher({ id: voucherId, reason })
              : enableVoucher({ id: voucherId, reason })
          }
        >
          <DropdownMenuItem
            aria-label="Power voucher"
            onSelect={(selectEvent) => selectEvent.preventDefault()}
          >
            <Power className="size-4" />
            {isEnabled ? "Tắt" : "Bật"}
          </DropdownMenuItem>
        </ConfirmPromotionAction>
        <ConfirmPromotionAction
          title="Xoá voucher"
          description={IRREVERSIBLE_CONFIRMATION}
          confirmLabel="Xoá"
          isPending={isDeleting}
          onClose={() => setOpenDropdown(false)}
          onConfirm={(reason) => deleteVoucher({ id: voucherId, reason })}
        >
          <DropdownMenuItem
            aria-label="Trash voucher"
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

export const voucherColumns: ColumnDef<VoucherType>[] = [
  {
    accessorKey: "code",
    header: () => <span>Mã voucher</span>,
    cell: ({ row }) => <span className="font-semibold">{row.original.code}</span>,
  },
  {
    accessorKey: "discountValue",
    header: () => <span>Ưu đãi</span>,
    cell: ({ row }) =>
      row.original.discountType === "percentage"
        ? `${row.original.discountValue}%`
        : formatPrice(row.original.discountValue),
  },
  {
    accessorKey: "minimumOrderValue",
    header: () => <span>Đơn tối thiểu</span>,
    cell: ({ row }) => formatPrice(row.original.minimumOrderValue),
  },
  {
    accessorKey: "maximumDiscountAmount",
    header: () => <span>Giảm tối đa</span>,
    cell: ({ row }) =>
      row.original.maximumDiscountAmount
        ? formatPrice(row.original.maximumDiscountAmount)
        : "-",
  },
  {
    accessorKey: "usedCount",
    header: () => <span>Lượt dùng</span>,
    cell: ({ row }) => `${row.original.usedCount ?? 0} / ${row.original.usageLimit ?? 0}`,
  },
  {
    accessorKey: "status",
    header: () => <span>Trạng thái</span>,
    cell: ({ row }) => <VoucherStatusBadge status={row.original.status} />,
  },
  {
    id: "actions",
    cell: ({ row }) => <VoucherActionsCell voucher={row.original} />,
  },
];
