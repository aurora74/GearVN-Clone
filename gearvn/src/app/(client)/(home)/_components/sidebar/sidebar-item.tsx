import Link from "next/link";
import { forwardRef } from "react";

import { Icon } from "@iconify/react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/utils/cn";
import { getIconForCategory } from "@/utils/get/get-icon-for-category";

import { CategoryType } from "@/types/category";
import { useDropdownPosition } from "@/hooks/use-dropdown-position";

import { CategoryDropdown } from "./category-dropdown";

type SidebarItemProps = {
  isActive: boolean;
  onHover: () => void;
  onLeave: () => void;
  category: CategoryType;
  dropdownPosition: ReturnType<typeof useDropdownPosition>["dropdownPosition"];
};

export const SidebarItem = forwardRef<HTMLLIElement, SidebarItemProps>(
  ({ category, isActive, onHover, onLeave, dropdownPosition }, ref) => {
    const hasDropdown = category.fields.length > 0;

    const IconComponent = getIconForCategory(category.name);

    return (
      <li
        ref={ref}
        role="menuitem"
        onBlur={onLeave}
        onFocus={onHover}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        className={cn(
          "group relative rounded cursor-pointer",
          isActive
            ? "text-white bg-primary"
            : "hover:text-white hover:bg-primary"
        )}
      >
        <Link
          href={`/collections/${category.name}`}
          className="flex items-center justify-between p-2"
        >
          <div className="flex items-center gap-3">
            <Icon icon={IconComponent} fontSize={18} />
            <p className="text-sm line-clamp-1">{category.label}</p>
          </div>
          {hasDropdown && <ChevronRight className="size-4" />}
        </Link>

        {hasDropdown && isActive && (
          <CategoryDropdown
            onLeave={onLeave}
            onHover={onHover}
            category={category}
            dropdownPosition={dropdownPosition}
          />
        )}
      </li>
    );
  }
);

SidebarItem.displayName = "SidebarItem";
