"use client";

import Link from "next/link";
import { useState } from "react";

import { Icon } from "@iconify/react";
import { AlignJustify } from "lucide-react";

import { CategoryType } from "@/types/category";
import { getIconForCategory } from "@/utils/get/get-icon-for-category";
import { buildCollectionUrl } from "@/utils/build/build-collection-url";

import {
  Sheet,
  SheetTitle,
  SheetHeader,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";

export const CategoriesMenu = ({
  categories,
}: {
  categories: CategoryType[];
}) => {
  const [open, setOpen] = useState(false);
  const isEmpty = categories.length === 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Mở menu danh mục"
          className="block lg:hidden cursor-pointer"
        >
          <AlignJustify className="size-6 text-white" />
        </button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-[80%] max-w-sm gap-0 p-0 [&_svg]:text-white bg-white"
      >
        <SheetHeader className="py-3 px-4 bg-primary">
          <SheetTitle className="text-base font-bold text-white">
            Danh mục sản phẩm
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-full">
          <nav aria-label="Danh mục sản phẩm" className="p-3">
            {isEmpty ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Hiện chưa có danh mục nào.
              </p>
            ) : (
              <Accordion type="multiple" className="space-y-2">
                {categories.map((category) => (
                  <AccordionItem
                    key={category._id}
                    value={category._id}
                    className="border-none"
                  >
                    <AccordionTrigger
                      aria-label={`Mở danh mục ${category.label}`}
                      className="group p-2 hover:text-white [&_svg]:!text-black hover:[&_svg]:!text-white hover:bg-primary rounded text-left"
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          fontSize={20}
                          icon={getIconForCategory(category.name)}
                          className="!text-black group-hover:!text-white"
                        />
                        <span className="text-sm line-clamp-1">
                          {category.label}
                        </span>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="pt-2 pb-4 pl-2 space-y-6">
                      {category.fields.map((field) => (
                        <div key={field.name} className="space-y-2">
                          <h4 className="font-semibold text-primary">
                            {field.label}
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {field.options?.map((option) => (
                              <Link
                                key={option}
                                href={buildCollectionUrl(
                                  category.name,
                                  field.name,
                                  field.type,
                                  option
                                )}
                                className="block text-sm hover:text-primary"
                                onClick={() => setOpen(false)} // <- đây
                              >
                                {option}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
