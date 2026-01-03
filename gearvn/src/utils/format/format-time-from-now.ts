import { vi } from "date-fns/locale";
import { formatDistanceToNow } from "date-fns";

export const formatTimeFromNow = (date: Date | string | number): string => {
  if (!date) return "";

  return formatDistanceToNow(new Date(date), {
    addSuffix: true,
    locale: vi,
  });
};
