"use client";

import { Home } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";

import { ScrollArea } from "../ui/scroll-area";

type Crumb = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: Crumb[];
};

export const Breadcrumbs = ({ items }: BreadcrumbsProps) => {
  return (
    <div className="py-3 bg-white">
      <ScrollArea className="overflow-x-auto">
        <Breadcrumb className="wrapper min-w-max">
          <BreadcrumbList className="flex items-center gap-2">
            {items.map((item, index) => {
              const isLast = index === items.length - 1;

              return (
                <div className="flex items-center gap-2" key={index}>
                  <BreadcrumbItem>
                    {item.href && !isLast ? (
                      <BreadcrumbLink
                        href={item.href}
                        className="flex items-center gap-1 whitespace-nowrap"
                      >
                        {index === 0 && <Home size={16} />}
                        {item.label}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="flex items-center gap-1 whitespace-nowrap">
                        {index === 0 && <Home size={16} />}
                        {item.label}
                      </BreadcrumbPage>
                    )}
                  </BreadcrumbItem>

                  {!isLast && <BreadcrumbSeparator />}
                </div>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </ScrollArea>
    </div>
  );
};
