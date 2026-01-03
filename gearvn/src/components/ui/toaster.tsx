import { toast } from "sonner";
import { XIcon, CheckCircle2, AlertCircle } from "lucide-react";

type ToastType = "success" | "error";

const renderToast = (
  t: any,
  type: ToastType,
  title: string,
  description?: string
) => {
  const isSuccess = type === "success";

  return (
    <div className="bg-background border shadow-lg px-4 py-3 rounded-md w-full sm:w-[400px] text-foreground">
      <div className="flex items-start gap-3">
        {isSuccess ? (
          <CheckCircle2 className="text-green-500 mt-1" size={20} />
        ) : (
          <AlertCircle className="text-red-500 mt-1" size={20} />
        )}

        <div className="flex-1 text-[15px]">
          <p className="font-medium">{title}</p>
          {description && (
            <p className="text-muted-foreground text-[13px]">{description}</p>
          )}
        </div>

        <button
          onClick={() => toast.dismiss(t)}
          className="text-muted-foreground hover:text-foreground transition cursor-pointer"
        >
          <XIcon size={16} />
        </button>
      </div>
    </div>
  );
};

export const toastSuccess = (title: string, description?: string) => {
  toast.custom((t) => renderToast(t, "success", title, description));
};

export const toastError = (title: string, description?: string) => {
  toast.custom((t) => renderToast(t, "error", title, description));
};
