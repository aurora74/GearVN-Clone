import Link from "next/link";

import { SERVICE_FEATURES } from "@/constants/home/service-features";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export const ServiceFeatures = () => (
  <ScrollArea className="bg-white">
    <nav aria-label="Điều hướng dịch vụ nổi bật">
      <h2 className="sr-only">Dịch vụ nổi bật</h2>
      <div className="wrapper">
        <ul className="w-full h-[45px] inline-flex items-center gap-4 sm:gap-6 md:gap-8">
          {SERVICE_FEATURES.map(({ icon: Icon, label, href }) => (
            <li key={label} className="flex-1 flex items-center justify-center">
              <Link
                href={href}
                className="flex items-center gap-2 text-sm font-medium hover:text-primary"
              >
                <Icon className="size-5" aria-hidden="true" />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
    <ScrollBar orientation="horizontal" />
  </ScrollArea>
);
