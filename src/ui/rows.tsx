import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function RowList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-hairline">{children}</ul>;
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
      <span className="min-w-0 flex-1 basis-48 overflow-visible text-left text-[15px] font-[510] leading-[1.5] tracking-[-0.012em]">
        {label}
      </span>
      {meta ? (
        <span className="text-[13px] leading-[1.5] text-ink-muted tabular-nums">{meta}</span>
      ) : null}
    </>
  );
  const rowClass = cn(
    "flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 py-3",
    (href || onSelect) && "hover:bg-surface-2 active:bg-surface-3",
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
