import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
    <header className="mb-6">
      {back ? <div className="mb-3">{back}</div> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {typeof title === "string" ? (
            <h1 className="text-[28px] font-medium leading-[1.5]">{title}</h1>
          ) : (
            title
          )}
          {meta ? <div className="mt-1 text-[14px] text-muted-foreground">{meta}</div> : null}
        </div>
        {primary || secondary ? (
          <div className="flex flex-wrap items-center gap-2">
            {primary}
            {secondary}
          </div>
        ) : null}
      </div>
      {filter ? <div className="mt-3">{filter}</div> : null}
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
            "inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-[14px]",
            value === opt.id ? "bg-muted text-accent" : "text-muted-foreground hover:bg-muted",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
