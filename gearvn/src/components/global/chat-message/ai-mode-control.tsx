"use client";

import { Bot, Headset } from "lucide-react";

import { cn } from "@/utils/cn";
import { AssistantMode } from "@/types/chat";

import { Button } from "@/components/ui/button";

type AiModeControlProps = {
  mode: AssistantMode;
  disabled?: boolean;
  onModeChange: (mode: AssistantMode) => void;
};

const MODE_OPTIONS: Array<{
  mode: AssistantMode;
  label: string;
  Icon: typeof Bot;
}> = [
  { mode: "ai", label: "AI tư vấn", Icon: Bot },
  { mode: "staff", label: "Nhân viên", Icon: Headset },
];

export const AiModeControl = ({
  mode,
  disabled,
  onModeChange,
}: AiModeControlProps) => {
  const nextMode = mode === "staff" ? "ai" : "staff";
  const actionLabel =
    mode === "staff" ? "Tiếp tục với AI" : "Chat với nhân viên tư vấn";

  return (
    <div className="border-b bg-white px-5 py-3">
      <div
        aria-label="Chọn chế độ tư vấn"
        className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1"
        role="group"
      >
        {MODE_OPTIONS.map(({ mode: optionMode, label, Icon }) => {
          const isSelected = mode === optionMode;

          return (
            <Button
              key={optionMode}
              type="button"
              variant={isSelected ? "default" : "ghost"}
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onModeChange(optionMode)}
              className={cn(
                "min-h-12 rounded-sm px-3 text-base font-medium focus-visible:ring-2 focus-visible:ring-primary/70",
                !isSelected && "bg-transparent text-muted-foreground"
              )}
            >
              <Icon className="size-5" />
              <span className="whitespace-normal leading-tight">{label}</span>
            </Button>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => onModeChange(nextMode)}
        className="mt-3 min-h-12 w-full whitespace-normal rounded-sm px-4 text-base font-medium focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        {actionLabel}
      </Button>
    </div>
  );
};
