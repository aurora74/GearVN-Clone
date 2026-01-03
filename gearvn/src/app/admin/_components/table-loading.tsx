import { Loader } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";

import { TableCell, TableRow } from "@/components/ui/table";

export const TableLoading = <TData,>({
  columns,
}: {
  columns: ColumnDef<TData, any>[];
}) => {
  return (
    <TableRow>
      <TableCell colSpan={columns.length} className="p-0">
        <div className="h-[calc(100vh-280px)] flex flex-col items-center justify-center gap-3">
          <Loader className="text-primary animate-spin" />
          <p>Đang tải...</p>
        </div>
      </TableCell>
    </TableRow>
  );
};
