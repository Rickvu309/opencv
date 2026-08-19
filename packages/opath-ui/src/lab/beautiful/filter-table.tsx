import { useMemo, useState } from "react";
import { Chip } from "../../chip";
import { cn } from "../../cn";
import "./beautiful.css";

export type FilterStatus = "all" | "todo" | "progress" | "completed";

export interface FilterRow {
  id: string;
  name: string;
  date: string;
  status: Exclude<FilterStatus, "all">;
  advisor: string;
}

export interface FilterTableProps {
  rows?: FilterRow[];
}

const DEFAULT_ROWS: FilterRow[] = [
  { id: "1", name: "Restock north batch", date: "Dec 03", status: "todo", advisor: "North works" },
  { id: "2", name: "Review the evening run", date: "Sep 22", status: "progress", advisor: "Kumo hall" },
  { id: "3", name: "Print summer menu", date: "Jan 02", status: "todo", advisor: "Coral coast" },
  { id: "4", name: "Taste-test batch 42", date: "Nov 08", status: "progress", advisor: "Maple orbit" },
  { id: "5", name: "Order packing sleeves", date: "Apr 14", status: "completed", advisor: "Aurora hall" },
];

const FILTERS: { id: FilterStatus; label: string; status?: ChipStatus }[] = [
  { id: "all", label: "All" },
  { id: "todo", label: "To do", status: "muted" },
  { id: "progress", label: "In progress", status: "progress" },
  { id: "completed", label: "Completed", status: "positive" },
];

type ChipStatus = "progress" | "positive" | "attention" | "muted";

export function FilterTable({ rows = DEFAULT_ROWS }: FilterTableProps) {
  const [filter, setFilter] = useState<FilterStatus>("all");
  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((row) => row.status === filter)),
    [filter, rows],
  );

  return (
    <div className="w-full max-w-[26rem]">
      <div className="mb-1 flex items-center gap-1 overflow-x-auto py-1">
        {FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              className={cn(
                "flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-[510] transition-colors duration-[var(--duration-fast)]",
                active ? "bg-surface-1 text-ink shadow-[var(--shadow-overlay)]" : "text-ink-secondary hover:bg-surface-2",
              )}
              onClick={() => setFilter(item.id)}
            >
              {item.status ? (
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    item.status === "positive" && "bg-status-positive",
                    item.status === "progress" && "bg-status-progress",
                    item.status === "muted" && "bg-ink-muted",
                  )}
                  aria-hidden="true"
                />
              ) : null}
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        className="overflow-x-auto rounded-[var(--radius-container)] border border-hairline bg-surface-1"
        role="region"
        aria-label="Scrollable task table"
        tabIndex={0}
      >
        <div className="min-w-[26rem]">
          <div className="grid grid-cols-[1.3fr_0.6fr_0.95fr_0.9fr] border-b border-hairline px-3 py-2 text-[11.5px] font-[510] text-ink-muted">
            <span>Task name</span>
            <span>Date</span>
            <span>Status</span>
            <span>Advisor</span>
          </div>
          {visible.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[1.3fr_0.6fr_0.95fr_0.9fr] items-center border-b border-hairline px-3 py-2 text-[12px] last:border-0 hover:bg-surface-2"
            >
              <span className="truncate font-[510] text-ink">{row.name}</span>
              <span className="text-ink-muted tabular-nums">{row.date}</span>
              <span>
                <Chip
                  tone="status"
                  status={row.status === "completed" ? "positive" : row.status === "progress" ? "progress" : "muted"}
                >
                  {row.status === "todo" ? "To do" : row.status === "progress" ? "In progress" : "Completed"}
                </Chip>
              </span>
              <span className="truncate text-ink-secondary">{row.advisor}</span>
            </div>
          ))}
          {visible.length === 0 ? (
            <p className="px-3 py-4 text-[13px] text-ink-muted">No rows for this filter. Choose All to see every task.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
