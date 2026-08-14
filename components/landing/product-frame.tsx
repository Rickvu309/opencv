"use client";

import { Undo2 } from "lucide-react";

import { useT } from "@/lib/i18n/use-t";

/**
 * The differentiator, as a conversation rather than a sentence.
 *
 * A screenshot would go stale the moment the Coach UI moved. This is tokens
 * and two lines of copy, so "the Coach edits, you undo" is always what the
 * page currently looks like.
 */
export function ProductFrame() {
  const { t, m } = useT();

  return (
    <figure
      className="rounded-xl border bg-card p-2 outline outline-1 -outline-offset-1 outline-black/10 shadow-[0_0_0_1px_oklch(0_0_0/0.06),0_1px_2px_-1px_oklch(0_0_0/0.06)] transition-[box-shadow] duration-[var(--duration-press)] ease-snap hover:shadow-md motion-reduce:transition-none"
    >
      <div className="flex flex-col gap-3 rounded-md bg-background p-4">
        <Bubble who={t(m.landing.you)} align="end">
          {t(m.landing.frameUser)}
        </Bubble>
        <Bubble who={t(m.landing.coachName)} align="start">
          {t(m.landing.frameCoach)}
        </Bubble>
        <div className="flex justify-start">
          <span className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1 text-xs text-muted-foreground">
            <Undo2 className="size-3" />
            {t(m.common.undo)}
          </span>
        </div>
      </div>
      <figcaption className="sr-only">{t(m.landing.controlNote)}</figcaption>
    </figure>
  );
}

function Bubble({
  who,
  align,
  children,
}: {
  who: string;
  align: "start" | "end";
  children: string;
}) {
  return (
    <div className={align === "end" ? "flex flex-col items-end" : "flex flex-col items-start"}>
      <p className="mb-1 text-[11px] text-muted-foreground">{who}</p>
      <p
        className={
          align === "end"
            ? "max-w-[90%] rounded-lg bg-primary px-3 py-2 text-[15px] leading-7 text-primary-foreground"
            : "max-w-[90%] rounded-lg bg-muted px-3 py-2 text-[15px] leading-7 text-foreground"
        }
      >
        {children}
      </p>
    </div>
  );
}
