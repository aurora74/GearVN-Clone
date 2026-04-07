import { useState } from "react";
import { useRouter } from "next/navigation";

import { MoreVertical, Clipboard, PackageCheck, Pencil, Trash2 } from "lucide-react";

import { USER_ROLE } from "@/config.global";
import { ProductType } from "@/types/product";
import { useMe } from "@/react-query/query/user";

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
  const { data: currentUser } = useMe();
  const [openDropdown, setOpenDropdown] = useState(false);

  const canManageStock =
    currentUser?.role === USER_ROLE.MANAGER ||
    currentUser?.role === USER_ROLE.SALES_OPERATIONS_STAFF;
  const canManageCatalog = currentUser?.role !== USER_ROLE.SALES_OPERATIONS_STAFF;

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

        {canManageCatalog && (
          <DropdownMenuItem
            onSelect={() => router.push(`/admin/products/${product._id}`)}
            className="group hover:!bg-blue-500/10"
          >
            <Pencil className="size-4 group-hover:text-blue-500" />
            <p className="group-hover:text-blue-500">Sửa</p>
          </DropdownMenuItem>
        )}

        {canManageStock && (
          <DropdownMenuItem
            onSelect={() => router.push(`/admin/products/${product._id}?workflow=stock`)}
            className="group hover:!bg-blue-500/10"
          >
            <PackageCheck className="size-4 group-hover:text-blue-500" />
            <p className="group-hover:text-blue-500">Cập nhật tồn kho</p>
          </DropdownMenuItem>
        )}

        {canManageCatalog && (
          <>
            <DropdownMenuSeparator />

            <ModalDeleteProduct product={product} setOpenDropdown={setOpenDropdown}>
              <DropdownMenuItem
                variant="destructive"
                onSelect={(e) => e.preventDefault()}
                className="group"
              >
                <Trash2 className="size-4 group-hover:text-red-500" />
                <p className="group-hover:text-red-500">Lưu trữ nội dung</p>
                <span className="sr-only">
                  Bản ghi sẽ bị ẩn khỏi storefront nhưng vẫn được giữ để đối soát.
                </span>
              </DropdownMenuItem>
            </ModalDeleteProduct>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ActionsCell;
