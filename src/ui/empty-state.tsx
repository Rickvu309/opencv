import type { ReactNode } from "react";
import { Button } from "@/ui/button";

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
    <div className="py-12" data-empty-kind={kind}>
      <p className="text-pretty text-[15px] leading-[1.6] text-ink">{title}</p>
      {basis ? <p className="mt-2 text-[13px] leading-[1.5] text-ink-muted">{basis}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
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
        <a href={href}>
          <Button variant="outline">{label}</Button>
        </a>
      }
    />
  );
}
