"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "../../cn";

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer relative inline-flex shrink-0 items-center rounded-[var(--radius-pill)] border border-transparent outline-none transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--focus-ring)] data-checked:bg-accent data-unchecked:bg-surface-3 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-[size=default]:h-6 data-[size=default]:w-10 data-[size=sm]:h-5 data-[size=sm]:w-8",
        className,
      )}
      data-size={size}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block rounded-full bg-surface-1 transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] data-unchecked:translate-x-0.5",
          size === "sm"
            ? "size-4 data-checked:translate-x-3.5"
            : "size-5 data-checked:translate-x-[18px]",
        )}
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
