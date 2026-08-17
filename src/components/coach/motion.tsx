"use client";

import * as React from "react";

import { disclose } from "@/components/ui/disclose";
import { cn } from "@/lib/utils";

export function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}

/**
 * transitions.dev icon-swap (09), on OpenPath tokens.
 *
 * Two icons stay stacked in one slot. The outgoing one scales to 0.25, blurs
 * 2px, and fades; the incoming one does the reverse. `--ease-snap` and
 * `--duration-state` are the house spelling of the recipe's 250ms ease-in-out.
 * Reduced motion keeps the opacity flip and drops travel and blur.
 */
export const iconSwapItem =
  "absolute inset-0 size-full transition-[opacity,scale,filter] duration-[var(--duration-state)] ease-snap motion-reduce:scale-100 motion-reduce:blur-none motion-reduce:transition-[opacity] motion-reduce:duration-[var(--duration-press)]";
export const iconSwapIn = "scale-100 opacity-100 blur-none";
export const iconSwapOut = "scale-[0.25] opacity-0 blur-[2px]";

/** Accordion plus a fade, for the empty-kit greeting/starters fold. */
export function kitFold(open: boolean) {
  return cn(
    disclose(open),
    "transition-[grid-template-rows,opacity,margin-bottom]",
    open ? "mb-4 opacity-100" : "mb-0 opacity-0",
  );
}

/**
 * transitions.dev texts-reveal (18), empty kit only.
 *
 * Two chunks, 100ms apart: greeting → composer. 8px rise
 * (`slide-in-from-bottom-2`) over `--duration-surface` on `--ease-enter`.
 * Cap stays three. Reduced motion skips the utility (`motion-safe:`).
 */
export function coachReveal(step: 0 | 1 | 2 = 0) {
  return cn(
    "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2",
    "motion-safe:duration-[var(--duration-surface)] motion-safe:ease-enter",
    "motion-safe:fill-mode-backwards",
    step === 1 && "motion-safe:delay-100",
    step === 2 && "motion-safe:delay-200",
  );
}

/**
 * transitions.dev text-states-swap (04), three-phase.
 *
 * `.is-exit` slides the old line 4px up + blur. After `--text-swap-dur` the
 * text swaps, `.is-enter-start` jumps it below with no transition, then a
 * reflow lets it settle. Reduced motion snaps. See `.t-text-swap` in
 * `globals.css`.
 */
export function TextSwap({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = React.useState(text);
  const [phase, setPhase] = React.useState<"rest" | "exit" | "enter">("rest");
  const incoming = React.useRef(text);
  const node = React.useRef<HTMLSpanElement>(null);

  if (reduced && shown !== text) {
    setShown(text);
    setPhase("rest");
  } else if (!reduced && shown !== text && phase === "rest") {
    incoming.current = text;
    setPhase("exit");
  }

  React.useEffect(() => {
    if (phase !== "exit") return;
    const raw = node.current
      ? getComputedStyle(node.current).getPropertyValue("--text-swap-dur")
      : "";
    const dur = parseFloat(raw) || 300;
    const id = window.setTimeout(() => {
      setShown(incoming.current);
      setPhase("enter");
      requestAnimationFrame(() => {
        void node.current?.offsetHeight;
        setPhase("rest");
      });
    }, dur);
    return () => window.clearTimeout(id);
  }, [phase]);

  return (
    <span
      ref={node}
      className={cn(
        "t-text-swap",
        phase === "exit" && "is-exit",
        phase === "enter" && "is-enter-start",
        className,
      )}
    >
      {shown}
    </span>
  );
}
