import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { useAuthModal } from "@/stores/use-auth-modal";

import { toastSuccess, toastError } from "@/components/ui/toaster";

export const useEmailVerification = () => {
  const router = useRouter();
  const hasVerifiedRef = useRef(false);
  const searchParams = useSearchParams();

  const { setModal } = useAuthModal();

  useEffect(() => {
    const token = searchParams.get("verifyToken");
    if (!token || hasVerifiedRef.current) return;

    hasVerifiedRef.current = true;

    const verifyEmail = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?verifyToken=${token}`);
        const data = await res.json();

        if (!res.ok) {
          toastError(data.message, data.description);
          return;
        }

        toastSuccess(data.message, data.description);
        setModal("login");
      } catch {
        toastError("Đã có lỗi xảy ra", "Vui lòng thử lại sau.");
      } finally {
        const url = new URL(window.location.href);
        url.searchParams.delete("verifyToken");
        router.replace(url.pathname + url.search, { scroll: false });
      }
    };

    verifyEmail();
  }, [searchParams, router, setModal]);
};
