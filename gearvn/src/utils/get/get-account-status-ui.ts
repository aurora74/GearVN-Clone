import { LucideIcon } from "lucide-react";
import { CheckCircle2, Loader, XCircle } from "lucide-react";

import { ACCOUNT_STATUS } from "@/config.global";
import { AccountStatusType } from "@/types/auth";

type StatusUI = {
  label: string;
  icon: LucideIcon;
  className: string;
};

export const getAccountStatusUI = (status: AccountStatusType): StatusUI => {
  switch (status) {
    case ACCOUNT_STATUS.VERIFIED:
      return {
        label: "Hoạt động",
        icon: CheckCircle2,
        className: "text-green-500",
      };
    case ACCOUNT_STATUS.UNVERIFIED:
      return {
        label: "Chờ kích hoạt",
        icon: Loader,
        className: "text-yellow-500 animate-spin",
      };
    case ACCOUNT_STATUS.BANNED:
    default:
      return {
        label: "Cấm",
        icon: XCircle,
        className: "text-red-500",
      };
  }
};
