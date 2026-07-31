"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface WhyThisReadingProps {
  text: string;
}

/**
 * Small expandable rationale every AI Analysis tab block carries, so the
 * Copilot's reasoning stays one click away without cluttering the scannable
 * first read.
 */
export function WhyThisReading({ text }: WhyThisReadingProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        Why this reading
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>
      {open ? <p className="text-xs text-muted-foreground">{text}</p> : null}
    </div>
  );
}
