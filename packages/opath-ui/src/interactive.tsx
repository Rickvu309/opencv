import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type InteractiveState = "empty" | "filled" | "selected";

interface InteractiveProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  state?: InteractiveState;
  asChild?: boolean;
  children: ReactNode;
}

function Interactive({
  state = "empty",
  asChild,
  className,
  children,
  type = "button",
  ...props
}: InteractiveProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      type={asChild ? undefined : type}
      data-state={state}
      className={cn(
        "inline-flex min-h-10 items-center rounded-[var(--radius-control)] px-2 text-left text-[13px] font-[510] transition-[background-color,color,transform,opacity] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.97] disabled:opacity-50",
        state === "selected"
          ? "bg-surface-3 font-[590] text-ink"
          : "text-ink-secondary hover:bg-surface-2 active:bg-surface-3",
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

export { Interactive, type InteractiveProps, type InteractiveState };
