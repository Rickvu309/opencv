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
      <p className="text-[18px] leading-[1.6]">{title}</p>
      {basis ? <p className="mt-2 text-[14px] leading-[1.6] text-muted-foreground">{basis}</p> : null}
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
