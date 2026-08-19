import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "./cn";

interface SwitchProps extends SwitchPrimitive.SwitchProps {
  className?: string;
}

function Switch({ className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "inline-flex h-6 w-10 shrink-0 items-center rounded-[var(--radius-pill)] bg-surface-3 transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] data-[state=checked]:bg-accent",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-surface-1 transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}

export { Switch, type SwitchProps };
