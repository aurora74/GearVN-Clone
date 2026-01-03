"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/utils/cn";

function Input({
  className,
  type,
  ...props
}: React.ComponentProps<"input"> & { type?: string }) {
  const [show, setShow] = React.useState(false);
  const isPassword = type === "password";

  return (
    <div className="w-full relative">
      <input
        spellCheck={false}
        type={isPassword ? (show ? "text" : "password") : type}
        data-slot="input"
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary disselection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 text-sm",
          "focus-visible:border-primary/80 focus-visible:ring-primary/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          isPassword ? "pr-10" : "",
          className
        )}
        {...props}
      />
      {isPassword && (
        <button
          type="button"
          disabled={props.disabled}
          onClick={() => setShow((prev) => !prev)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          tabIndex={-1}
        >
          {show ? (
            <EyeOff className="size-4.5" />
          ) : (
            <Eye className="size-4.5" />
          )}
        </button>
      )}
    </div>
  );
}

export { Input };
