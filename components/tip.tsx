"use client";

import { Info } from "lucide-react";

import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Explains a number or concept in place, only when the user asks.
 * Use sparingly; each tip admits the label alone was not clear enough.
 */
export function Tip({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { t, m } = useT();
  return (
    <Popover>
      <PopoverTrigger
        aria-label={t(m.common.explain(title))}
        className={cn(
          // size-6 = 24px: the minimum target size from WCAG 2.2.
          "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
          className,
        )}
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {children}
        </p>
      </PopoverContent>
    </Popover>
  );
}
