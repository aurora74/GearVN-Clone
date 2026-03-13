import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[calc(100vh-96px)] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4 rounded-md border bg-white p-6 text-center shadow-sm">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold">Khong co quyen truy cap</h1>
          <p className="text-sm text-muted-foreground">
            Tai khoan hien tai khong co quyen mo chuc nang nay.
          </p>
        </div>

        <Button asChild>
          <Link href="/admin/dashboard">Ve trang phu hop</Link>
        </Button>
      </div>
    </div>
  );
}
