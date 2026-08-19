import { useEffect, useState } from "react";
import { Checkbox } from "../../checkbox";
import { cn } from "../../cn";
import "./beautiful.css";
import { usePrefersReducedMotion } from "./hooks";

export interface DiffRow {
  id: string;
  name: string;
  category: string;
  supplier: string;
  proposed?: Partial<Pick<DiffRow, "name" | "category" | "supplier">>;
  included?: boolean;
}

export interface DiffTableProps {
  title?: string;
  rows?: DiffRow[];
}

const DEFAULT_ROWS: DiffRow[] = [
  { id: "1", name: "Classic line", category: "Core", supplier: "aurora-hall" },
  {
    id: "2",
    name: "Archive SKU",
    category: "Legacy",
    supplier: "kumo-hall",
    proposed: { category: "Seasonal" },
  },
  { id: "3", name: "Weekend pack", category: "Core", supplier: "maple-orbit" },
  {
    id: "4",
    name: "Pilot SKU",
    category: "Seasonal",
    supplier: "maple-orbit",
    proposed: { name: "North batch", category: "Core", supplier: "north-works" },
    included: true,
  },
];

export function DiffTable({ title = "Proposed catalog cleanup", rows = DEFAULT_ROWS }: DiffTableProps) {
  const reduced = usePrefersReducedMotion();
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(rows.map((row) => [row.id, row.included ?? Boolean(row.proposed)])),
  );
  const [sweep, setSweep] = useState(0);

  useEffect(() => {
    if (reduced) {
      setSweep(rows.length);
      return;
    }
    setSweep(0);
    const id = window.setInterval(() => {
      setSweep((n) => {
        if (n >= rows.length) {
          window.clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, 420);
    return () => window.clearInterval(id);
  }, [reduced, rows.length]);

  return (
    <div className="w-full max-w-[30rem] overflow-hidden rounded-[var(--radius-container)] border border-hairline bg-surface-1">
      <p className="px-3 py-2 text-[13px] font-[510] text-ink">{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[12.5px]">
          <thead>
            <tr className="border-y border-hairline text-ink-muted">
              <th className="w-8 px-3 py-2 font-[510]">
                <span className="sr-only">Include</span>
              </th>
              <th className="px-3 py-2 font-[510]">Name</th>
              <th className="px-3 py-2 font-[510]">Category</th>
              <th className="px-3 py-2 font-[510]">Supplier</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const live = i < sweep;
              const next = live ? { ...row, ...row.proposed } : row;
              const changed = Boolean(row.proposed) && live;
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-hairline last:border-0",
                    changed && "bg-[color-mix(in_srgb,var(--status-progress)_10%,transparent)]",
                  )}
                >
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={checked[row.id] ?? false}
                      onCheckedChange={(value) =>
                        setChecked((prev) => ({ ...prev, [row.id]: value === true }))
                      }
                      aria-label={`Include ${next.name}`}
                    />
                  </td>
                  <td className="px-3 py-2 font-[510] text-ink">{next.name}</td>
                  <td className="px-3 py-2 text-ink-secondary">{next.category}</td>
                  <td className="px-3 py-2 font-mono text-[12px] text-ink-secondary">{next.supplier}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
