import { useState } from "react";

import { MoreVertical, Clipboard, Edit, Trash } from "lucide-react";

import { EventType } from "@/types/event";

import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toastSuccess } from "@/components/ui/toaster";

import { ModalEditEvent } from "@/components/modals/admin/events/edit";
import { ModalDeleteEvent } from "@/components/modals/admin/events/delete";

export const ActionsCell = ({ event }: { event: EventType }) => {
  const [openDropdown, setOpenDropdown] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(event._id);
    toastSuccess("Đã sao chép ID", "Mã sự kiện đã được lưu vào clipboard.");
    setOpenDropdown(false);
  };

  return (
    <DropdownMenu open={openDropdown} onOpenChange={setOpenDropdown}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={handleCopyId}
          className="group hover:!bg-blue-500/10"
        >
          <Clipboard className="size-4 group-hover:text-blue-500" />
          <span className="group-hover:text-blue-500">Copy ID</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <ModalEditEvent event={event} setOpenDropdown={setOpenDropdown}>
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="group hover:!bg-green-500/10"
          >
            <Edit className="size-4 group-hover:text-green-500" />
            <span className="group-hover:text-green-500">Sửa</span>
          </DropdownMenuItem>
        </ModalEditEvent>

        <ModalDeleteEvent event={event} setOpenDropdown={setOpenDropdown}>
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="group hover:!bg-red-500/10"
          >
            <Trash className="size-4 group-hover:text-red-500" />
            <span className="group-hover:text-red-500">Xóa</span>
          </DropdownMenuItem>
        </ModalDeleteEvent>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
