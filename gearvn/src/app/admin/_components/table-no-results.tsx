import { ColumnDef } from "@tanstack/react-table";

import { TableCell, TableRow } from "@/components/ui/table";

export const TableNoResults = <TData,>({
  columns,
}: {
  columns: ColumnDef<TData, any>[];
}) => {
  return (
    <TableRow>
      <TableCell colSpan={columns.length} className="p-0">
        <div className="h-[calc(100vh-280px)] flex items-center justify-center text-muted-foreground">
          Không có kết quả.
        </div>
      </TableCell>
    </TableRow>
  );
};
