import Image from "next/image";

import { Button } from "../../ui/button";

type Props = { isPending: boolean };

export const ButtonLoginGoogle = ({ isPending }: Props) => {
  const handleLoginWithGoogle = () => {
    window.location.href = "/api/auth/google/login";
  };

  return (
    <Button
      type="button"
      size="xl"
      variant="outline"
      disabled={isPending}
      onClick={handleLoginWithGoogle}
      className="w-full rounded-sm"
    >
      <Image src="/auth/google.png" alt="Google" width={20} height={20} />
      <p className="ml-2">Đăng nhập với Google</p>
    </Button>
  );
};
