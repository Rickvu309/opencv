import {
  getCoreRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy";

import type { DriveRow } from "./drive";

const columns: LegacyColumnDef<DriveRow>[] = [
  {
    id: "kind",
    accessorFn: (row) => row.kind,
  },
  {
    id: "label",
    accessorFn: (row) => row.item.label,
  },
];

/** Headless table over Drive rows. The visual list stays custom. */
export function useDriveTable(rows: DriveRow[]) {
  const table = useLegacyTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) =>
      row.kind === "paper" ? `paper:${row.item.id}` : `upload:${row.item.id}`,
  });
  return table.getRowModel().rows.map((row) => row.original);
}
