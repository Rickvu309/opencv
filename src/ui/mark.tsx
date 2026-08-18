import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-[var(--radius-tag)] bg-accent",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 16" className="size-2.5 fill-none stroke-on-accent" strokeWidth="1.75">
        <path d="M3 11.5 8 4.5l5 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
