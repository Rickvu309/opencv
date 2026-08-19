import { Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "../../cn";
import "./beautiful.css";
import { usePrefersReducedMotion } from "./hooks";

export type FineTuneLayout = "row" | "col" | "grid";

export interface FineTuneCardProps {
  title?: string;
}

export function FineTuneCard({ title = "Preview card" }: FineTuneCardProps) {
  const [layout, setLayout] = useState<FineTuneLayout>("row");
  const [width, setWidth] = useState(324);
  const [height, setHeight] = useState(96);
  const [radius, setRadius] = useState(12);
  const [opacity, setOpacity] = useState(100);
  const [type, setType] = useState("Sans");
  const reduced = usePrefersReducedMotion();

  return (
    <div className="relative w-full max-w-60 rounded-[var(--radius-container)] border border-hairline bg-surface-1">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <span className="text-[13px] font-[510] text-ink">{title}</span>
        <span className="flex items-center gap-1.5">
          <span className="flex size-4 items-center justify-center rounded-[var(--radius-tag)] bg-surface-2">
            <Sparkles className="size-2.5 text-ink" aria-hidden="true" />
          </span>
          <span className={cn("text-[12px] font-[510]", reduced ? "text-ink-muted" : "beautiful-shimmer")}>
            Adjust
          </span>
        </span>
      </div>
      <div className="flex flex-col gap-2 border-b border-hairline p-3">
        <p className="text-[12.5px] font-[510] text-ink">Layout</p>
        <div className="relative grid grid-cols-3 rounded-[var(--radius-control)] bg-surface-2 p-0.5">
          <span
            aria-hidden="true"
            className="absolute inset-y-0.5 rounded-[var(--radius-control)] bg-surface-1 transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)]"
            style={{
              width: "calc((100% - 4px) / 3)",
              left: 2,
              transform: `translateX(${layout === "row" ? 0 : layout === "col" ? 100 : 200}%)`,
            }}
          />
          {(["row", "col", "grid"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-label={`${item} layout`}
              aria-pressed={layout === item}
              className={cn(
                "relative z-10 flex h-6 items-center justify-center",
                layout === item ? "text-ink" : "text-ink-faint",
              )}
              onClick={() => setLayout(item)}
            >
              <LayoutGlyph layout={item} />
            </button>
          ))}
        </div>
        <SliderRow label="W" value={width} min={160} max={400} onChange={setWidth} />
        <SliderRow label="H" value={height} min={64} max={180} onChange={setHeight} />
        <SliderRow label="Radius" value={radius} min={0} max={28} onChange={setRadius} />
        <SliderRow label="Opacity" value={opacity} min={40} max={100} suffix="%" onChange={setOpacity} />
      </div>
      <div className="flex flex-col gap-2 p-3">
        <p className="text-[12.5px] font-[510] text-ink">Type</p>
        <label className="sr-only" htmlFor="fine-tune-type">
          Select type
        </label>
        <select
          id="fine-tune-type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="min-h-8 rounded-[var(--radius-control)] border border-hairline bg-surface-1 px-2 text-[13px] text-ink"
        >
          <option>Sans</option>
          <option>Serif</option>
          <option>Mono</option>
        </select>
        <div
          className={cn(
            "mt-1 border border-hairline bg-surface-2 p-2",
            layout === "row" && "flex gap-2",
            layout === "col" && "flex flex-col gap-2",
            layout === "grid" && "grid grid-cols-2 gap-2",
          )}
          style={{
            width: Math.min(width, 220),
            minHeight: height / 2,
            borderRadius: radius,
            opacity: opacity / 100,
            fontFamily: type === "Mono" ? "ui-monospace, monospace" : type === "Serif" ? "Georgia, serif" : "inherit",
          }}
        >
          <span className="text-[12px] text-ink">Title</span>
          <span className="text-[11px] text-ink-muted">Body line</span>
        </div>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-12 text-[12px] text-ink-muted" htmlFor={`fine-tune-${label}`}>
        {label}
        {suffix ?? ""}
      </label>
      <input
        id={`fine-tune-${label}`}
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        className="min-w-0 flex-1 accent-[var(--accent)]"
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <input
        aria-label={`${label} value`}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || min)}
        className="w-12 rounded-[var(--radius-tag)] border border-hairline bg-surface-1 px-1 text-right text-[12px] tabular-nums"
      />
    </div>
  );
}

function LayoutGlyph({ layout }: { layout: FineTuneLayout }) {
  if (layout === "row") {
    return (
      <span className="flex gap-0.5">
        <i className="size-1.5 rounded-[2px] border-[1.2px] border-current" aria-hidden="true" />
        <i className="size-1.5 rounded-[2px] border-[1.2px] border-current" aria-hidden="true" />
        <i className="size-1.5 rounded-[2px] border-[1.2px] border-current" aria-hidden="true" />
      </span>
    );
  }
  if (layout === "col") {
    return (
      <span className="flex flex-col gap-0.5">
        <i className="size-1.5 rounded-[2px] border-[1.2px] border-current" aria-hidden="true" />
        <i className="size-1.5 rounded-[2px] border-[1.2px] border-current" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="grid grid-cols-2 gap-0.5">
      <i className="size-1.5 rounded-[2px] border-[1.2px] border-current" aria-hidden="true" />
      <i className="size-1.5 rounded-[2px] border-[1.2px] border-current" aria-hidden="true" />
      <i className="size-1.5 rounded-[2px] border-[1.2px] border-current" aria-hidden="true" />
      <i className="size-1.5 rounded-[2px] border-[1.2px] border-current" aria-hidden="true" />
    </span>
  );
}
