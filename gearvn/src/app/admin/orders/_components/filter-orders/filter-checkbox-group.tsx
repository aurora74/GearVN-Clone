import { useMemo } from "react";

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type Option = {
  label: string;
  value: string;
  group?: string;
};

type FilterCheckboxGroupProps = {
  label: string;
  options: Option[];
  selected: string[];
  setSelected: (value: string[]) => void;
};

export const FilterCheckboxGroup = ({
  label,
  options,
  selected,
  setSelected,
}: FilterCheckboxGroupProps) => {
  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      setSelected(selected.filter((v) => v !== value));
    } else {
      setSelected([...selected, value]);
    }
  };

  const groupedOptions = useMemo(() => {
    const groups: Record<string, Option[]> = {};
    options.forEach((opt) => {
      const group = opt.group || "default";
      if (!groups[group]) groups[group] = [];
      groups[group].push(opt);
    });
    return groups;
  }, [options]);

  return (
    <div className="space-y-2">
      <Label className="text-base font-semibold">{label}</Label>

      {Object.entries(groupedOptions).map(([groupName, opts]) => (
        <div key={groupName} className="mb-2">
          {groupName !== "default" && (
            <div className="text-sm font-medium text-gray-700 mb-1">
              {groupName}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {opts.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center space-x-2 cursor-pointer"
              >
                <Checkbox
                  checked={selected.includes(opt.value)}
                  onCheckedChange={() => handleToggle(opt.value)}
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
