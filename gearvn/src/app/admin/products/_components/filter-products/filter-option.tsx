import { Checkbox } from "@/components/ui/checkbox";

type FilterOptionProps = {
  option: string;
  checked: boolean;
  fieldName: string;
  onToggle: (fieldName: string, value: string) => void;
};

export const FilterOption = ({
  option,
  checked,
  onToggle,
  fieldName,
}: FilterOptionProps) => {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      onClick={() => onToggle(fieldName, option)}
      className="flex items-center gap-2 p-1 cursor-pointer select-none"
    >
      <Checkbox checked={checked} />
      <span className="text-sm">{option}</span>
    </div>
  );
};
