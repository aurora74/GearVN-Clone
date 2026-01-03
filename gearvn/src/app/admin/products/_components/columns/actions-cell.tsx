import { useState } from "react";
import { useRouter } from "next/navigation";

import { MoreVertical, Clipboard, Pencil, Trash2 } from "lucide-react";

import { ProductType } from "@/types/product";

import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toastSuccess } from "@/components/ui/toaster";

import { ModalDeleteProduct } from "@/components/modals/admin/product/delete";

const ActionsCell = ({ product }: { product: ProductType }) => {
  const router = useRouter();
  const [openDropdown, setOpenDropdown] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(product._id);
    toastSuccess("Đã sao chép ID", "Mã sản phẩm đã được lưu vào clipboard.");
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
        <DropdownMenuItem
          onClick={handleCopyId}
          className="group hover:!bg-blue-500/10"
        >
          <Clipboard className="size-4 group-hover:text-blue-500" />
          <p className="group-hover:text-blue-500">Copy ID</p>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() => router.push(`/admin/products/${product._id}`)}
          className="group hover:!bg-blue-500/10"
        >
          <Pencil className="size-4 group-hover:text-blue-500" />
          <p className="group-hover:text-blue-500">Sửa</p>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <ModalDeleteProduct product={product} setOpenDropdown={setOpenDropdown}>
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => e.preventDefault()}
            className="group"
          >
            <Trash2 className="size-4 group-hover:text-red-500" />
            <p className="group-hover:text-red-500">Xóa</p>
          </DropdownMenuItem>
        </ModalDeleteProduct>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ActionsCell;
