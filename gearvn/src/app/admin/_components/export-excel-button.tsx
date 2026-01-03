import { Icon } from "@iconify/react";

import { exportToExcel } from "@/utils/export-excel";

import { Button } from "@/components/ui/button";

type ExportExcelButtonProps<T> = {
  data: T[];
  fileName?: string;
  tableColumns: { id: string; getIsVisible: () => boolean }[];
};

export const ExportExcelButton = <T,>({
  data,
  tableColumns,
  fileName = "data.xlsx",
}: ExportExcelButtonProps<T>) => {
  const handleExport = () => {
    const visibleColumns = tableColumns
      .filter((col) => col.getIsVisible())
      .map((col) => col.id);

    exportToExcel(data, visibleColumns, fileName);
  };

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      className="w-full sm:w-fit flex items-center gap-2 text-green-600 hover:text-green-600  border-green-600 hover:bg-green-50"
    >
      <Icon icon="vscode-icons:file-type-excel2" className="size-4.5" />
      <p>Xuất Excel</p>
    </Button>
  );
};
