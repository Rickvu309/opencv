import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { cn } from "./cn";

interface DataTableProps<T> {
  // ColumnDef is invariant in TValue; mixed columns need a wide slot.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  data: T[];
  className?: string;
}

function DataTable<T>({ columns, data, className }: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left">
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id} className="border-b border-hairline">
              {group.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-3 py-2 text-[13px] font-[510] text-ink-muted"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-hairline">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-surface-2">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2 text-[15px] leading-[1.5]">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { DataTable, type DataTableProps };
export { createColumnHelper } from "@tanstack/react-table";
