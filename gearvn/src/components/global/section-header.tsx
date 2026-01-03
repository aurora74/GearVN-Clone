import Link from "next/link";

import { ChevronRight } from "lucide-react";

type Props = {
  href?: string;
  title: string;
  srLabel?: string;
  linkLabel?: string;
};

export const SectionHeader = ({
  href,
  title,
  srLabel,
  linkLabel = "Xem tất cả",
}: Props) => {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>

      {href && (
        <Link
          href={href}
          aria-label={srLabel || linkLabel}
          className="flex flex-shrink-0 items-center gap-2 text-[15px] text-blue-500 font-medium hover:underline"
        >
          {linkLabel}
          <ChevronRight className="size-4" />
          <span className="sr-only">{srLabel || linkLabel}</span>
        </Link>
      )}
    </div>
  );
};
