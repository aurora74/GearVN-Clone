"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState, memo } from "react";

import { CategoryType } from "@/types/category";
import { DropdownPositionType } from "@/types/global";

import { cn } from "@/utils/cn";
import { buildCollectionUrl } from "@/utils/build/build-collection-url";

type CategoryDropdownProps = {
  onHover: () => void;
  onLeave: () => void;
  category: CategoryType;
  dropdownPosition: DropdownPositionType;
};

export const CategoryDropdown = memo(function CategoryDropdown({
  onHover,
  onLeave,
  category,
  dropdownPosition,
}: CategoryDropdownProps) {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      role="menu"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        maxHeight: dropdownPosition.maxHeight,
      }}
      aria-label={`Danh mục con của ${category.label}`}
      className={cn(
        "absolute min-w-[1000px] max-h-[80vh] p-4 bg-white shadow-lg rounded-sm overflow-y-auto custom-scroll z-50 transform transition-all duration-200 ease-out",
        isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
      )}
    >
      <div className="grid grid-cols-5 gap-6">
        {category.fields.map((field) => (
          <div key={field.name}>
            <p
              id={`category-${category.name}-${field.name}`}
              className="text-sm font-bold text-primary mb-2"
            >
              {field.label}
            </p>
            <ul
              role="menu"
              aria-labelledby={`category-${category.name}-${field.name}`}
              className="space-y-1"
            >
              {field.options?.map((option) => (
                <li key={option} role="menuitem">
                  <Link
                    href={buildCollectionUrl(
                      category.name,
                      field.name,
                      field.type,
                      option
                    )}
                    className="block text-sm text-gray-700 hover:text-primary"
                  >
                    {option}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
});
