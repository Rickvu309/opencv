import { cn } from "./cn";

export function SuggestionList({
  items,
  onPick,
  className,
}: {
  items: { id: string; label: string }[];
  onPick: (id: string, label: string) => void;
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <ul className={cn("flex flex-wrap justify-center gap-2", className)}>
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className="inline-flex min-h-10 items-center rounded-[var(--radius-pill)] border border-hairline px-3 text-[13px] font-[510] transition-[background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-surface-2 focus-visible:shadow-[var(--focus-ring)] active:scale-[0.97] active:bg-surface-3"
            onClick={() => onPick(item.id, item.label)}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
