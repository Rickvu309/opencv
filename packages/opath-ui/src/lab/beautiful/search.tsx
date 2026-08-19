import { Search as SearchIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Input } from "../../input";
import "./beautiful.css";

export interface SearchProps {
  items?: string[];
  placeholder?: string;
}

const DEFAULT_ITEMS = [
  "Forecast summer demand",
  "Find packing vendors",
  "Compare seasonal lines",
  "Draft a launch plan",
  "Check cold-chain status",
];

export function Search({
  items = DEFAULT_ITEMS,
  placeholder = "Search…",
}: SearchProps) {
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<{ top: number; height: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.toLowerCase().includes(q));
  }, [items, query]);

  function onEnter(event: React.MouseEvent<HTMLElement>) {
    const row = event.currentTarget;
    const root = listRef.current;
    if (!root) return;
    const rootBox = root.getBoundingClientRect();
    const box = row.getBoundingClientRect();
    setHover({ top: box.top - rootBox.top, height: box.height });
  }

  return (
    <div className="flex min-h-[15.5rem] w-full max-w-72 flex-col">
      <div className="overflow-hidden rounded-[var(--radius-container)] border border-hairline bg-surface-1 shadow-[var(--shadow-overlay)]">
        <div className="flex h-10 items-center gap-2 border-b border-hairline px-3">
          <SearchIcon className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
          <Input
            aria-label="Search"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-0 border-0 bg-transparent px-0 text-[13px] shadow-none focus-visible:border-0"
          />
        </div>
        <div ref={listRef} className="relative p-1" onMouseLeave={() => setHover(null)}>
          {filtered.length ? (
            <>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-1 rounded-[var(--radius-control)] bg-surface-2"
                style={{
                  height: hover?.height ?? 0,
                  opacity: hover ? 1 : 0,
                  transform: `translateY(${hover?.top ?? 0}px)`,
                  transition:
                    "transform var(--duration-base) var(--ease-out), opacity var(--duration-fast) var(--ease-out)",
                }}
              />
              {filtered.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="relative z-10 flex h-8 w-full items-center rounded-[var(--radius-control)] px-2 text-left text-[13px] text-ink"
                  onMouseEnter={onEnter}
                >
                  {item}
                </button>
              ))}
            </>
          ) : (
            <p className="px-2 py-3 text-[13px] text-ink-muted">
              No results for '{query}'. Widen the search.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
