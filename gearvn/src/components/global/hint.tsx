import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type HintProps = {
  children: React.ReactNode;
  label: string;
};

export const Hint = ({ children, label }: HintProps) => {
  return (
    <Tooltip>
      <TooltipTrigger className="block" asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
};
