import { cn } from "@/lib/utils";

/**
 * Height accordion for disclosures that are not Radix `.acc-panel`.
 * Inner child must use `discloseInner` (`overflow: hidden` on the 0fr track).
 */
export function disclose(open: boolean) {
  return cn(
    "grid transition-[grid-template-rows] motion-reduce:transition-none",
    open
      ? "grid-rows-[1fr] duration-[var(--duration-surface)] ease-enter"
      : "grid-rows-[0fr] duration-[var(--duration-state)] ease-exit",
  );
}

export const discloseInner = "min-h-0 overflow-hidden";
