"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

interface ExpandableRowProps {
  label: ReactNode;
  detail: string;
  tone?: "default" | "caution";
  defaultOpen?: boolean;
  className?: string;
}

/**
 * One labeled row that expands to a short paragraph of rationale. Shared by
 * the AI Analysis tab's interpretation expectations, vague-language decode,
 * and validation signals, plus any other Copilot block that needs a
 * scannable label with progressive depth underneath.
 */
export function ExpandableRow({
  label,
  detail,
  tone = "default",
  defaultOpen = false,
  className,
}: ExpandableRowProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "rounded-lg border",
        tone === "caution" ? "border-rose-200 dark:border-rose-500/30" : "border-border",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-foreground outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring",
          open ? "rounded-t-lg" : "rounded-lg"
        )}
        aria-expanded={open}
      >
        <span>{label}</span>
        {open ? (
          <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open ? (
        <div className="border-t border-border px-3 py-2">
          <p className="text-sm text-muted-foreground">{detail}</p>
        </div>
      ) : null}
    </div>
  );
}
