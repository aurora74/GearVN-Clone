import { useState, useCallback } from "react";

import { DropdownPositionType } from "@/types/global";

export const useDropdownPosition = () => {
  const [dropdownPosition, setDropdownPosition] =
    useState<DropdownPositionType>({
      top: 0,
      left: 0,
      maxHeight: 350,
    });

  const calculatePosition = useCallback((targetEl: HTMLElement | null) => {
    if (!targetEl) return;

    const rect = targetEl.getBoundingClientRect();

    const MARGIN = 8;
    const DROPDOWN_MAX_HEIGHT = 350;
    const viewportTop = window.scrollY + MARGIN;
    const viewportBottom = window.scrollY + window.innerHeight - MARGIN;

    let dropdownTop = rect.top + window.scrollY;

    const availableHeight = viewportBottom - viewportTop;
    const maxHeight = Math.min(DROPDOWN_MAX_HEIGHT, availableHeight);

    const desiredBottom = dropdownTop + DROPDOWN_MAX_HEIGHT;
    if (desiredBottom > viewportBottom) {
      dropdownTop = Math.max(viewportTop, viewportBottom - DROPDOWN_MAX_HEIGHT);
    }

    if (dropdownTop < viewportTop) dropdownTop = viewportTop;

    setDropdownPosition({
      maxHeight,
      top: dropdownTop,
      left: rect.right + window.scrollX,
    });
  }, []);

  return { dropdownPosition, calculatePosition };
};
