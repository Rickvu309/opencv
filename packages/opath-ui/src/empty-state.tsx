import type { ReactNode } from "react";
import { buttonClass } from "./button";

export type EmptyKind = "first-run" | "cleared" | "filtered" | "error" | "offline";

export function EmptyState({
  title,
  basis,
  action,
  kind = "first-run",
}: {
  title: string;
  basis?: string;
  action?: ReactNode;
  kind?: EmptyKind;
}) {
  return (
    <div className="max-w-xl pt-1 pb-8" data-empty-kind={kind}>
      <p className="text-pretty text-[15px] leading-[1.6] text-ink">{title}</p>
      {basis ? <p className="mt-2 text-[13px] leading-[1.5] text-ink-muted">{basis}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      kind="error"
      title="Couldn't load this. Try again."
      action={
        <button type="button" className={buttonClass("outline")} onClick={onRetry}>
          Try again
        </button>
      }
    />
  );
}

export function NotFoundState({
  title,
  href,
  label,
}: {
  title: string;
  href: string;
  label: string;
}) {
  return (
    <EmptyState
      kind="error"
      title={title}
      action={
        <a href={href} className={buttonClass("outline")}>
          {label}
        </a>
      }
    />
  );
}
