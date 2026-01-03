import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { useAuthModal } from "@/stores/use-auth-modal";
import { toastSuccess, toastError } from "@/components/ui/toaster";

export const useResetPassword = () => {
  const router = useRouter();
  const hasHandledRef = useRef(false);
  const searchParams = useSearchParams();

  const { setModal, setResetToken } = useAuthModal();

  useEffect(() => {
    const token = searchParams.get("resetToken");
    if (!token || hasHandledRef.current) return;

    hasHandledRef.current = true;

    const clearQuery = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("resetToken");
      router.replace(url.pathname + url.search, { scroll: false });
    };

    const verifyResetToken = async () => {
      const res = await fetch(
        `/api/auth/verify-reset-token?resetToken=${token}`
      );
      const { message, description } = await res.json();

      if (!res.ok) {
        toastError(message, description);
        clearQuery();
        return;
      }

      setResetToken(token);
      setModal("reset-password");
      toastSuccess(message, description);
      clearQuery();
    };

    verifyResetToken();
  }, [searchParams, router, setModal, setResetToken]);
};
