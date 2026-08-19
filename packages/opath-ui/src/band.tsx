import type { ReactNode } from "react";
import { cn } from "./cn";

export function Band({
  title,
  back,
  primary,
  secondary,
  filter,
  meta,
}: {
  title: ReactNode;
  back?: ReactNode;
  primary?: ReactNode;
  secondary?: ReactNode;
  filter?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="mb-4">
      {back ? <div className="mb-2">{back}</div> : null}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 sm:flex-nowrap">
        <div className="min-w-0">
          {typeof title === "string" ? (
            <h1 className="text-balance overflow-visible text-[24px] font-[590] leading-[1.3] tracking-[-0.017em]">
              {title}
            </h1>
          ) : (
            title
          )}
          {meta ? <div className="mt-1 text-[13px] text-ink-muted">{meta}</div> : null}
        </div>
        {primary || secondary ? (
          <div data-band-actions className="flex shrink-0 flex-wrap items-center gap-1">
            {primary}
            {secondary}
          </div>
        ) : null}
      </div>
      {filter ? <div className="mt-2">{filter}</div> : null}
    </header>
  );
}

export function BandFilter({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "inline-flex min-h-[var(--size-touch)] items-center rounded-[var(--radius-control)] px-3 text-[13px] md:min-h-10",
            value === opt.id
              ? "bg-surface-3 text-accent"
              : "text-ink-muted hover:bg-surface-2",
          )}
          aria-pressed={value === opt.id}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
