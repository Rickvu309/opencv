import { useState } from "react";
import { Button } from "../../button";
import { Chip } from "../../chip";
import { cn } from "../../cn";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../collapsible";
import "./beautiful.css";

export interface RecommendationOption {
  label: string;
  hint: string;
  bars: 0 | 1 | 2 | 3;
}

export interface RecommendationCardProps {
  title?: string;
  body?: string;
  tokens?: string[];
  confidenceLabel?: string;
  confidence?: 1 | 2 | 3;
  alternatives?: RecommendationOption[];
  onAccept?: () => void;
}

function ConfidenceBars({ value }: { value: number }) {
  return (
    <span className="flex items-end gap-0.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "h-2.5 w-1 rounded-full",
            i < value ? "bg-status-positive" : "bg-hairline",
          )}
        />
      ))}
    </span>
  );
}

export function RecommendationCard({
  title = "Want me to place this restock order?",
  body = "Reorder the core SKU from {vendor} with lead time {lead}.",
  tokens = ["north_works", "7_days"],
  confidenceLabel = "High confidence",
  confidence = 3,
  alternatives = [
    { label: "Switch to the backup vendor", hint: "Needs review", bars: 2 },
    { label: "Full restock across every SKU", hint: "No signal", bars: 0 },
  ],
  onAccept,
}: RecommendationCardProps) {
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const parts = body.split(/\{[^}]+\}/);

  return (
    <div className="w-full max-w-[24rem] overflow-hidden rounded-[var(--radius-container)] border border-hairline bg-surface-1">
      <div className="p-4">
        <p className="text-[13px] font-[590] text-ink">{title}</p>
        <p className="mt-1.5 min-h-12 text-[13px] leading-relaxed text-ink-secondary">
          {parts[0]}
          {tokens[0] ? <Chip tone="code">{tokens[0]}</Chip> : null}
          {parts[1]}
          {tokens[1] ? <Chip tone="code">{tokens[1]}</Chip> : null}
          {parts[2]}
        </p>
      </div>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleContent>
          <div className="border-t border-hairline bg-surface-2 px-2 py-2">
            <p className="px-1.5 pb-1 text-[11px] font-[510] text-ink-faint">Other options</p>
            {alternatives.map((option) => (
              <button
                key={option.label}
                type="button"
                className="flex w-full items-center gap-2.5 rounded-[var(--radius-control)] px-1.5 py-1.5 text-left transition-colors duration-[var(--duration-fast)] hover:bg-surface-3"
              >
                <ConfidenceBars value={option.bars} />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{option.label}</span>
                <span className="shrink-0 text-[11px] text-ink-faint">{option.hint}</span>
              </button>
            ))}
          </div>
        </CollapsibleContent>
        <div className="flex items-center justify-between gap-3 border-t border-hairline bg-surface-2 px-3 py-2">
          <span className="flex items-center gap-2">
            <ConfidenceBars value={confidence} />
            <span className="text-[12.5px] font-[510] text-ink-secondary">{confidenceLabel}</span>
          </span>
          <span className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="min-h-7 px-2.5 text-[12.5px]">
                Alternatives
              </Button>
            </CollapsibleTrigger>
            <Button
              size="sm"
              className="min-h-7 px-2.5 text-[12.5px]"
              disabled={accepted}
              onClick={() => {
                setAccepted(true);
                onAccept?.();
              }}
            >
              {accepted ? "Accepted" : "Accept"}
            </Button>
          </span>
        </div>
      </Collapsible>
    </div>
  );
}
