import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { cn } from "./cn";

function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200} skipDelayDuration={0}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

interface TooltipProps {
  tooltip: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  children: ReactNode;
  className?: string;
}

function Tooltip({ tooltip, side = "top", children, className }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-[var(--z-overlay)] max-w-xs rounded-[var(--radius-control)] border border-hairline bg-surface-1 px-2 py-1 text-[12px] leading-[1.5] text-ink shadow-[var(--shadow-overlay)]",
            className,
          )}
        >
          {tooltip}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export { Tooltip, TooltipProvider, type TooltipProps };
