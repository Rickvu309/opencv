import { ArrowUpRight, AlignLeft } from "lucide-react";
import { Chip } from "../../chip";
import "./beautiful.css";

export interface ContextCardItem {
  title: string;
  characters: number;
  body: string;
  sourceKind: string;
  sourceName: string;
}

export interface ContextCardsProps {
  heading?: string;
  items?: ContextCardItem[];
}

const DEFAULT_ITEMS: ContextCardItem[] = [
  {
    title: "Vendor onboarding rule",
    characters: 290,
    body: "Certification must be verified before a new vendor can be added to the reorder workflow.",
    sourceKind: "PDF",
    sourceName: "Vendor onboarding SOP.pdf",
  },
  {
    title: "Seasonal demand row",
    characters: 1250,
    body: "Q4 velocity table: north batch +18%, classic line +6%, retired SKU -11%; drop anything below 40 units weekly.",
    sourceKind: "CSV",
    sourceName: "Sales velocity export.csv",
  },
];

export function ContextCards({ heading = "All chunks", items = DEFAULT_ITEMS }: ContextCardsProps) {
  return (
    <div className="flex w-full max-w-[24rem] flex-col gap-2">
      <div className="flex items-center gap-2 px-0.5">
        <span className="text-[13px] font-[590] text-ink">{heading}</span>
      </div>
      {items.map((item) => (
        <article
          key={item.title}
          className="overflow-hidden rounded-[var(--radius-container)] border border-hairline bg-surface-1"
        >
          <div className="flex items-center gap-2.5 border-b border-hairline px-3 py-2">
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-[510] text-ink">
              <AlignLeft className="size-2.5" aria-hidden="true" />
              <span className="truncate">{item.title}</span>
            </span>
            <span className="ml-auto shrink-0 text-[12px] text-ink-faint tabular-nums">
              {item.characters.toLocaleString()} characters
            </span>
          </div>
          <p className="px-3 pt-2 pb-1 text-[12.5px] leading-relaxed text-ink-secondary">{item.body}</p>
          <div className="px-3 pb-3">
            <a
              href="#"
              className="inline-flex h-6 items-center gap-1.5 rounded-full bg-surface-2 px-2 text-[12px] font-[510] text-ink-secondary transition-colors duration-[var(--duration-fast)] hover:bg-surface-3"
            >
              <Chip tone="code" className="px-1 py-0 text-[10px]">
                {item.sourceKind}
              </Chip>
              {item.sourceName}
              <ArrowUpRight className="size-2.5" aria-hidden="true" />
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}
