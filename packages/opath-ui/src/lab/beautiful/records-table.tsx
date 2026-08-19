import { ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Chip } from "../../chip";
import { cn } from "../../cn";
import "./beautiful.css";

export type Connection = "very-strong" | "strong" | "weak" | "very-weak" | "none";

export interface RecordRow {
  id: string;
  company: string;
  city: string;
  tags: string[];
  last: string;
  connection: Connection;
  link?: string;
}

export interface RecordsTableProps {
  rows?: RecordRow[];
}

const STRENGTH: Record<Connection, string> = {
  "very-strong": "Very strong",
  strong: "Strong",
  weak: "Weak",
  "very-weak": "Very weak",
  none: "No communication",
};

const DEFAULT_ROWS: RecordRow[] = [
  {
    id: "1",
    company: "Alpine Works",
    city: "Zürich",
    tags: ["B2B", "Wholesale"],
    last: "4 days ago",
    connection: "very-strong",
    link: "alpine-works.example.com",
  },
  {
    id: "2",
    company: "Amber Studio",
    city: "Prague",
    tags: ["Retail"],
    last: "over 1 year ago",
    connection: "none",
  },
  {
    id: "3",
    company: "Andes North",
    city: "Quito",
    tags: ["Catering"],
    last: "almost 2 years ago",
    connection: "very-weak",
  },
  {
    id: "4",
    company: "Apricot Atlas",
    city: "Algiers",
    tags: ["Imports"],
    last: "11 months ago",
    connection: "very-weak",
    link: "apricot-atlas.example.com",
  },
  {
    id: "5",
    company: "Aurora Hall",
    city: "Reykjavík",
    tags: ["Seasonal"],
    last: "9 days ago",
    connection: "very-strong",
    link: "aurora-hall.example.com",
  },
  {
    id: "6",
    company: "Baltic Berry",
    city: "Tallinn",
    tags: ["B2C", "Seasonal"],
    last: "5 weeks ago",
    connection: "weak",
    link: "baltic-berry.example.com",
  },
  {
    id: "7",
    company: "Cedar Spoon",
    city: "Beirut",
    tags: ["Cafe", "Local"],
    last: "6 days ago",
    connection: "very-strong",
    link: "cedar-spoon.example.com",
  },
  {
    id: "8",
    company: "Delta Works",
    city: "New Orleans",
    tags: ["B2B", "Local"],
    last: "2 days ago",
    connection: "very-strong",
    link: "delta-works.example.com",
  },
];

type SortKey = "last" | "connection";

export function RecordsTable({ rows = DEFAULT_ROWS }: RecordsTableProps) {
  const [sort, setSort] = useState<SortKey>("connection");
  const [dir, setDir] = useState<1 | -1>(-1);

  const ordered = useMemo(() => {
    const rank: Record<Connection, number> = {
      "very-strong": 4,
      strong: 3,
      weak: 2,
      "very-weak": 1,
      none: 0,
    };
    return [...rows].sort((a, b) => {
      if (sort === "connection") return (rank[a.connection] - rank[b.connection]) * dir;
      return a.last.localeCompare(b.last) * dir;
    });
  }, [dir, rows, sort]);

  function toggle(key: SortKey) {
    if (sort === key) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(key);
      setDir(-1);
    }
  }

  return (
    <div
      className="max-h-80 w-full max-w-[40rem] overflow-auto rounded-[var(--radius-container)] border border-hairline bg-surface-1"
      aria-label="Companies table. Scroll to view all columns and records."
    >
      <table className="w-full min-w-[36rem] border-collapse text-left text-[12.5px]">
        <thead className="sticky top-0 bg-surface-1">
          <tr className="border-b border-hairline text-ink-muted">
            <th className="px-3 py-2 font-[510]">Company</th>
            <th className="px-3 py-2 font-[510]">Categories</th>
            <th className="px-3 py-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 font-[510]"
                onClick={() => toggle("last")}
              >
                Last interaction
                <ArrowUpDown className="size-3" aria-hidden="true" />
              </button>
            </th>
            <th className="px-3 py-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 font-[510]"
                onClick={() => toggle("connection")}
              >
                Connection strength
                <ArrowUpDown className="size-3" aria-hidden="true" />
              </button>
            </th>
            <th className="px-3 py-2 font-[510]">Links</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((row) => (
            <tr key={row.id} className="border-b border-hairline last:border-0 hover:bg-surface-2">
              <td className="px-3 py-2">
                <a href="#" className="font-[510] text-ink">
                  {row.company} — {row.city}
                </a>
              </td>
              <td className="px-3 py-2">
                <span className="flex flex-wrap gap-1">
                  {row.tags.map((tag) => (
                    <Chip key={tag}>{tag}</Chip>
                  ))}
                </span>
              </td>
              <td className="px-3 py-2 text-ink-muted tabular-nums">{row.last}</td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    "text-[12px]",
                    row.connection === "very-strong" || row.connection === "strong"
                      ? "text-status-positive"
                      : row.connection === "none"
                        ? "text-ink-faint"
                        : "text-status-attention",
                  )}
                >
                  {STRENGTH[row.connection]}
                </span>
              </td>
              <td className="px-3 py-2">
                {row.link ? (
                  <a href={`https://${row.link}`} className="text-ink-secondary">
                    {row.link}
                  </a>
                ) : (
                  <span className="text-ink-faint">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
