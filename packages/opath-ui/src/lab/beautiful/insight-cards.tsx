import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "../../button";
import { cn } from "../../cn";
import "./beautiful.css";

export interface Insight {
  id: string;
  summary: string;
  left: { label: string; change: string; amount: string; down?: boolean };
  right: { label: string; change: string; amount: string; down?: boolean };
  prompt: string;
  points: number[];
}

export interface InsightCardsProps {
  insights?: Insight[];
}

const DEFAULT_INSIGHTS: Insight[] = [
  {
    id: "worst",
    summary: "The worst performer in your catalog is the archive SKU — down -6% or -$2,453.44.",
    left: { label: "Weekend pack", change: "-4.41%", amount: "-$2,377.66", down: true },
    right: { label: "North batch", change: "+1.15%", amount: "+$617.22" },
    prompt: "Should I rebalance the lineup?",
    points: [42, 40, 38, 36, 33, 31, 28],
  },
  {
    id: "peak",
    summary: "Weekend peaks on the north batch are 18% above weekday volume.",
    left: { label: "Saturday", change: "+18%", amount: "+412 units" },
    right: { label: "Tuesday", change: "-9%", amount: "-90 units", down: true },
    prompt: "Want a weekend-weighted schedule?",
    points: [22, 24, 21, 40, 44, 28, 23],
  },
  {
    id: "lead",
    summary: "Two vendors now quote lead times under 7 days on the core SKU.",
    left: { label: "Fast lane", change: "5 days", amount: "2 vendors" },
    right: { label: "Standard", change: "12 days", amount: "4 vendors", down: true },
    prompt: "Switch the default vendor?",
    points: [12, 12, 11, 9, 8, 7, 5],
  },
];

export function InsightCards({ insights = DEFAULT_INSIGHTS }: InsightCardsProps) {
  const [index, setIndex] = useState(0);
  const insight = insights[index] ?? insights[0];
  if (!insight) return null;

  return (
    <div className="min-h-[22rem] w-full max-w-[22rem]">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-[590] text-ink">Insights</span>
        <span className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Previous insight"
            className="flex size-6 items-center justify-center rounded-[var(--radius-control)] text-ink-faint transition-colors duration-[var(--duration-fast)] hover:bg-surface-2 hover:text-ink"
            onClick={() => setIndex((i) => (i === 0 ? insights.length - 1 : i - 1))}
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Next insight"
            className="flex size-6 items-center justify-center rounded-[var(--radius-control)] text-ink-faint transition-colors duration-[var(--duration-fast)] hover:bg-surface-2 hover:text-ink"
            onClick={() => setIndex((i) => (i + 1) % insights.length)}
          >
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-secondary">{insight.summary}</p>
      <div className="mt-2 min-h-[14rem] rounded-[var(--radius-container)] border border-hairline bg-surface-1 p-3">
        <div className="flex items-center gap-4">
          <Stat {...insight.left} />
          <Stat {...insight.right} />
        </div>
        <div className="mt-2 overflow-hidden rounded-[var(--radius-control)] bg-surface-2">
          <div className="flex items-center justify-between border-b border-hairline px-2.5 py-1.5">
            <span className="text-[11px] text-ink-faint tabular-nums">Trend snapshot</span>
            <span className="rounded-full bg-surface-3 px-2 text-[11px] text-ink-muted">Snapshot</span>
          </div>
          <Sparkline points={insight.points} />
        </div>
      </div>
      <Button variant="outline" size="sm" className="mt-3 w-full">
        {insight.prompt}
      </Button>
    </div>
  );
}

function Stat({
  label,
  change,
  amount,
  down,
}: {
  label: string;
  change: string;
  amount: string;
  down?: boolean;
}) {
  return (
    <div className="flex-1">
      <span className="flex items-center gap-1.5 text-[11.5px] text-ink-secondary">
        <span
          className={cn("size-2 rounded-full", down ? "bg-status-attention" : "bg-accent")}
          aria-hidden="true"
        />
        {label}
      </span>
      <span
        className={cn(
          "block text-[17px] font-[590] tracking-[-0.01em] tabular-nums",
          down ? "text-destructive" : "text-status-positive",
        )}
      >
        {change}
      </span>
      <code className={cn("font-mono text-[11.5px]", down ? "text-destructive" : "text-status-positive")}>
        {amount}
      </code>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const w = 280;
  const h = 88;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / (max - min || 1)) * (h - 12) - 6;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" aria-hidden="true">
      <path d={d} fill="none" stroke="var(--ink)" strokeWidth="1.5" />
    </svg>
  );
}
