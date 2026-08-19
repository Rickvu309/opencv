import { Hoverable } from "./hoverable";
import { chipStatusDotClass, type ChipStatus } from "./chip";
import { createContext, useContext, type ReactNode } from "react";
import { cn } from "./cn";

const Bleed = createContext(false);

const typeColClass = "text-[13px] leading-[1.5] text-ink-muted sm:w-28 sm:shrink-0";
const updatedColClass =
  "text-[13px] leading-[1.5] text-ink-muted tabular-nums sm:w-28 sm:shrink-0";
const menuGutterClass = "w-11 shrink-0";

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

export function RowListHeader({
  name = "Name",
  type = "Type",
  updated = "Updated",
}: {
  name?: string;
  type?: string;
  updated?: string;
}) {
  const bleed = useContext(Bleed);
  return (
    <li aria-hidden="true" className="hidden items-center gap-1 sm:flex">
      <div
        className={cn(
          "flex min-h-8 min-w-0 flex-1 items-center gap-x-4 py-1 text-[12px] leading-[1.5] text-ink-faint",
          bleed && "px-5",
        )}
      >
        <span className="min-w-0 flex-1">{name}</span>
        <span className="w-28 shrink-0">{type}</span>
        <span className="w-28 shrink-0">{updated}</span>
      </div>
      <span className={cn(menuGutterClass, bleed && "pr-3")} />
    </li>
  );
}

export function Row({
  label,
  meta,
  type,
  updated,
  chip,
  menu,
  href,
  onSelect,
}: {
  label: ReactNode;
  meta?: ReactNode;
  type?: ReactNode;
  updated?: ReactNode;
  chip?: ReactNode;
  menu?: ReactNode;
  href?: string;
  onSelect?: () => void;
}) {
  const bleed = useContext(Bleed);
  const columns = type != null || updated != null;
  const body = columns ? (
    <>
      <span className="min-w-0 w-full overflow-visible text-left text-[15px] font-[510] leading-[1.5] tracking-[-0.012em] sm:w-auto sm:flex-1">
        {label}
      </span>
      {chip ? <span className="shrink-0">{chip}</span> : null}
      {type != null ? <span className={typeColClass}>{type}</span> : null}
      {updated != null ? <span className={updatedColClass}>{updated}</span> : null}
    </>
  ) : (
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
  const clickable = Boolean(href || onSelect);
  const rowClass = cn(
    "flex min-h-[var(--size-touch)] w-full min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-0.5 py-2",
    bleed && "px-5",
  );

  return (
    <li
      data-hover-group="row"
      className={cn(
        "relative flex items-center gap-1",
        clickable && "hover:bg-surface-2 active:bg-surface-3",
      )}
    >
      {href ? (
        <a href={href} className={rowClass}>
          {body}
        </a>
      ) : onSelect ? (
        <button type="button" onClick={onSelect} className={rowClass}>
          {body}
        </button>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
      {menu ? (
        <Hoverable.Item className={cn("shrink-0", bleed && "pr-3")}>{menu}</Hoverable.Item>
      ) : null}
    </li>
  );
}
