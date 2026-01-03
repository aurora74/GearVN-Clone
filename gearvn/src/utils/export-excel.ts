import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export const exportToExcel = <T>(
  data: T[],
  columns?: string[],
  fileName = "data.xlsx"
) => {
  if (!data || data.length === 0) return;

  const exportData = data.map((row) => {
    if (!columns) return row;

    const obj: Record<string, any> = {};
    columns.forEach((key) => {
      obj[key] = row[key as keyof T];
    });
    return obj;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, fileName);
};
