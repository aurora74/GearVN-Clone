"use client";

import { useState } from "react";
import { EyeOff, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ModerationAction = "hide" | "delete";

type ModerationActionsProps = {
  disabled?: boolean;
  deleteLabel?: "Xóa nội dung" | "Xóa bình luận" | "Xóa câu hỏi";
  onModerate: (payload: { action: ModerationAction; reason: string }) => void;
};

export const ModerationActions = ({
  disabled,
  onModerate,
  deleteLabel = "Xóa nội dung",
}: ModerationActionsProps) => {
  const [openAction, setOpenAction] = useState<ModerationAction | null>(null);
  const [reason, setReason] = useState("");

  const submit = () => {
    const normalized = reason.trim();
    if (!openAction || !normalized) return;

    onModerate({ action: openAction, reason: normalized });
    setReason("");
    setOpenAction(null);
  };

  const actionLabel = openAction === "delete" ? deleteLabel : "Ẩn nội dung";

  return (
    <div className="flex items-center gap-1">
      {(["hide", "delete"] as const).map((action) => {
        const label = action === "delete" ? deleteLabel : "Ẩn nội dung";
        const Icon = action === "delete" ? Trash2 : EyeOff;

        return (
          <Dialog
            key={action}
            open={openAction === action}
            onOpenChange={(nextOpen) => {
              setOpenAction(nextOpen ? action : null);
              if (!nextOpen) setReason("");
            }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={disabled}
                    aria-label={label}
                  >
                    <Icon className="size-4" />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>{label}</DialogTitle>
              </DialogHeader>

              <label className="space-y-2 text-sm font-medium">
                <span>Lý do nội bộ</span>
                <Textarea
                  value={reason}
                  rows={4}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenAction(null)}
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!reason.trim() || disabled}
                  onClick={submit}
                >
                  {actionLabel}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })}
    </div>
  );
};
