"use client";

import { useState, useRef } from "react";

import { CategoryType } from "@/types/category";
import { useDropdownPosition } from "@/hooks/use-dropdown-position";

import { SidebarItem } from "./sidebar-item";

export const Sidebar = ({ categories }: { categories: CategoryType[] }) => {
  const isEmpty = categories.length === 0;

  const { dropdownPosition, calculatePosition } = useDropdownPosition();

  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const handleMouseEnter = (index: number) => {
    setHoveredIdx(index);
    calculatePosition(itemRefs.current[index]);
  };

  const handleMouseLeave = () => setHoveredIdx(null);

  return (
    <nav
      aria-label="Danh mục sản phẩm"
      className="w-[15%] h-[530px] 2xl:h-[595px] relative hidden lg:block bg-white rounded-sm shadow-md overflow-hidden"
    >
      <h2 className="sr-only">Danh mục sản phẩm</h2>
      <div className="h-full overflow-y-auto custom-scroll">
        <ul role="menu">
          {isEmpty ? (
            <li className="list-none">
              <p className="text-sm text-muted-foreground py-6 text-center">
                Hiện chưa có danh mục nào.
              </p>
            </li>
          ) : (
            categories.map((category, idx) => (
              <SidebarItem
                key={category._id}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                category={category}
                onLeave={handleMouseLeave}
                isActive={hoveredIdx === idx}
                dropdownPosition={dropdownPosition}
                onHover={() => handleMouseEnter(idx)}
              />
            ))
          )}
        </ul>
      </div>
    </nav>
  );
};
