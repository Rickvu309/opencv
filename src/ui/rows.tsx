import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function RowList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-border">{children}</ul>;
}

export function Row({
  label,
  meta,
  menu,
  href,
  onSelect,
}: {
  label: ReactNode;
  meta?: ReactNode;
  menu?: ReactNode;
  href?: string;
  onSelect?: () => void;
}) {
  const body = (
    <>
      <span className="min-w-0 flex-1 basis-48 text-left leading-[1.6]">{label}</span>
      {meta ? (
        <span className="text-[14px] leading-[1.6] text-muted-foreground">{meta}</span>
      ) : null}
    </>
  );
  const rowClass = cn(
    "flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 py-3 text-[16px]",
    (href || onSelect) && "hover:bg-muted",
  );

  return (
    <li className="flex items-center gap-1">
      {href ? (
        <a href={href} className={cn(rowClass, "min-w-0 flex-1")}>
          {body}
        </a>
      ) : onSelect ? (
        <button type="button" onClick={onSelect} className={cn(rowClass, "min-w-0 flex-1")}>
          {body}
        </button>
      ) : (
        <div className={cn(rowClass, "min-w-0 flex-1")}>{body}</div>
      )}
      {menu ? <div className="shrink-0">{menu}</div> : null}
    </li>
  );
}
