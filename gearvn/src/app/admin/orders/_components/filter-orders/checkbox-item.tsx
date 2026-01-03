import { Checkbox } from "@/components/ui/checkbox";

type Option = {
  label: string;
  value: string;
};

type CheckboxItemProps = {
  option: Option;
  checked: boolean;
  onToggle: (value: string) => void;
};

export const CheckboxItem = ({
  option,
  checked,
  onToggle,
}: CheckboxItemProps) => (
  <label className="flex items-center space-x-2 cursor-pointer">
    <Checkbox
      checked={checked}
      onCheckedChange={() => onToggle(option.value)}
    />
    <span className="text-sm">{option.label}</span>
  </label>
);
