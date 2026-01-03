"use client";

import { CategoryType } from "@/types/category";

import {
  Sheet,
  SheetTitle,
  SheetHeader,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

export const CategoryDetailsCell = ({
  category,
}: {
  category: CategoryType;
}) => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="font-semibold hover:text-primary hover:underline cursor-pointer">
          {category.label}
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="min-w-full sm:min-w-[500px] gap-0">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="text-xl font-bold">
            Danh mục: {category.label}
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 overflow-y-auto custom-scroll">
          {category.fields.length > 0 ? (
            <div className="w-full overflow-x-auto">
              <table className="min-w-full text-sm border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-2 px-3 border border-gray-300 text-left whitespace-nowrap">
                      Tên thuộc tính
                    </th>
                    <th className="py-2 px-3 border border-gray-300 text-left whitespace-nowrap">
                      Loại
                    </th>
                    <th className="py-2 px-3 border border-gray-300 text-left">
                      Tùy chọn
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {category.fields.map((field) => (
                    <tr key={field.name}>
                      <td className="py-2 px-3 border border-gray-300 whitespace-nowrap">
                        {field.label}
                      </td>

                      <td className="py-2 px-3 border border-gray-300 whitespace-nowrap">
                        {field.type === "text"
                          ? "Văn bản"
                          : field.type === "number"
                          ? "Số"
                          : field.type}
                      </td>

                      <td className="py-2 px-3 border border-gray-300 break-words">
                        {field.options?.length ? field.options.join(", ") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="italic text-muted-foreground">Không có thuộc tính</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
