import { cn } from "../../cn";

export function DemoSwitch<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (next: T) => void;
  options: readonly T[];
  className?: string;
}) {
  return (
    <div className={cn("mt-3 flex flex-wrap gap-1", className)} role="tablist">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={value === option}
          className={cn(
            "min-h-8 rounded-[var(--radius-pill)] px-2.5 text-[12px] font-[510] capitalize transition-[background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-out)]",
            value === option
              ? "bg-surface-3 text-ink"
              : "text-ink-muted hover:bg-surface-2 hover:text-ink",
          )}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
