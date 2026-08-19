import { Hoverable } from "./hoverable";
import { chipStatusDotClass, type ChipStatus } from "./chip";
import { createContext, useContext, type ReactNode } from "react";
import { cn } from "./cn";

const Bleed = createContext(false);

export function GroupHeader({
  label,
  count,
  status,
}: {
  label: string;
  count?: number;
  status?: ChipStatus;
}) {
  return (
    <h2 className="-mx-5 flex items-center gap-2 bg-surface-2 px-5 py-2 text-[13px] font-[510] text-ink-muted tabular-nums">
      {status ? (
        <span className={cn("size-1.5 shrink-0 rounded-full", chipStatusDotClass(status))} aria-hidden="true" />
      ) : null}
      <span>{label}</span>
      {count != null ? <span aria-hidden="true">· {count}</span> : null}
    </h2>
  );
}

export function RowList({
  children,
  bleed = false,
}: {
  children: ReactNode;
  bleed?: boolean;
}) {
  return (
    <Bleed.Provider value={bleed}>
      <ul data-row-list className={cn("divide-y divide-hairline", bleed && "-mx-5")}>
        {children}
      </ul>
    </Bleed.Provider>
  );
}

export function Row({
  label,
  meta,
  chip,
  menu,
  href,
  onSelect,
}: {
  label: ReactNode;
  meta?: ReactNode;
  chip?: ReactNode;
  menu?: ReactNode;
  href?: string;
  onSelect?: () => void;
}) {
  const bleed = useContext(Bleed);
  const body = (
    <>
      <span className="min-w-0 flex-1 overflow-visible text-left text-[15px] font-[510] leading-[1.5] tracking-[-0.012em]">
        {label}
      </span>
      {chip ? <span className="shrink-0">{chip}</span> : null}
      {meta ? (
        <span className="ml-auto shrink-0 text-[13px] leading-[1.5] text-ink-muted tabular-nums">
          {meta}
        </span>
      ) : null}
    </>
  );
  const rowClass = cn(
    "flex min-h-[var(--size-touch)] w-full flex-wrap items-center gap-x-4 gap-y-1 py-2",
    bleed && "px-5",
    (href || onSelect) && "hover:bg-surface-2 active:bg-surface-3",
  );

  return (
    <Hoverable.Root>
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
        {menu ? (
          <Hoverable.Item className={cn("shrink-0", bleed && "pr-3")}>{menu}</Hoverable.Item>
        ) : null}
      </li>
    </Hoverable.Root>
  );
}
