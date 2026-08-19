import {
  BookOpen,
  ChevronDown,
  ChevronsLeft,
  Home,
  MessageSquare,
  PanelLeft,
  Plus,
  Search as SearchIcon,
  Sparkles,
} from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "../../cn";
import "./beautiful.css";

export interface SidebarItem {
  id: string;
  label: string;
}

export interface SidebarNavProps {
  workspace?: string;
  nav?: SidebarItem[];
  chats?: SidebarItem[];
}

const DEFAULT_NAV: SidebarItem[] = [
  { id: "new", label: "New chat" },
  { id: "home", label: "Home" },
  { id: "library", label: "Library" },
  { id: "invite", label: "Invite people" },
];

const DEFAULT_CHATS: SidebarItem[] = [
  { id: "c1", label: "Vendor records" },
  { id: "c2", label: "Urgent to-dos this morning" },
  { id: "c3", label: "Page ticket" },
  { id: "c4", label: "Workload summary" },
  { id: "c5", label: "Off-board a vendor" },
  { id: "c6", label: "Batch restock function" },
  { id: "c7", label: "Propose line edits" },
];

export function SidebarNav({
  workspace = "Workspace",
  nav = DEFAULT_NAV,
  chats = DEFAULT_CHATS,
}: SidebarNavProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState("c1");
  const [hover, setHover] = useState<{ top: number; height: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  function onEnter(event: React.MouseEvent<HTMLElement>) {
    const row = event.currentTarget;
    const root = listRef.current;
    if (!root) return;
    const rootBox = root.getBoundingClientRect();
    const box = row.getBoundingClientRect();
    setHover({ top: box.top - rootBox.top, height: box.height });
  }

  return (
    <aside
      aria-label="Workspace navigation"
      data-sidebar-collapsed={collapsed}
      className={cn(
        "relative flex h-[32rem] shrink-0 flex-col overflow-hidden rounded-[var(--radius-container)] border border-hairline bg-canvas transition-[width] duration-[var(--duration-base)] ease-[var(--ease-out)]",
        collapsed ? "w-[52px]" : "w-56",
      )}
    >
      <div className="relative mb-2.5 h-10 shrink-0">
        <button
          type="button"
          aria-expanded="false"
          className="absolute top-1 left-2 flex h-8 w-[10.25rem] items-center rounded-[var(--radius-control)] px-2 text-left transition-colors duration-[var(--duration-fast)] hover:bg-surface-2"
        >
          <Sparkles className="size-4 shrink-0 text-ink" aria-hidden="true" />
          {collapsed ? null : (
            <>
              <span className="ml-1.5 min-w-0 flex-1 truncate text-[14px] font-[510] text-ink-secondary">
                {workspace}
              </span>
              <ChevronDown className="size-4 text-ink-faint" aria-hidden="true" />
            </>
          )}
        </button>
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute top-1 right-2 flex size-8 items-center justify-center rounded-[var(--radius-control)] text-ink-faint transition-colors duration-[var(--duration-fast)] hover:bg-surface-2 hover:text-ink"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? (
            <PanelLeft className="size-4" aria-hidden="true" />
          ) : (
            <ChevronsLeft className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
      <div
        ref={listRef}
        className="relative flex min-h-0 flex-1 flex-col gap-0.5 px-2"
        onMouseLeave={() => setHover(null)}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-2 rounded-[var(--radius-control)] bg-surface-3"
          style={{
            height: hover?.height ?? 0,
            opacity: hover ? 1 : 0,
            transform: `translateY(${hover?.top ?? 0}px)`,
            transition:
              "transform var(--duration-base) var(--ease-out), opacity var(--duration-fast) var(--ease-out)",
          }}
        />
        {nav.map((item) => (
          <button
            key={item.id}
            type="button"
            className="relative z-10 flex h-9 w-full items-center gap-2 rounded-[var(--radius-control)] px-2 text-left text-[13px] text-ink"
            onMouseEnter={onEnter}
            onClick={() => setActive(item.id)}
          >
            {item.id === "new" ? (
              <Plus className="size-4 shrink-0" aria-hidden="true" />
            ) : item.id === "home" ? (
              <Home className="size-4 shrink-0" aria-hidden="true" />
            ) : item.id === "library" ? (
              <BookOpen className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <SearchIcon className="size-4 shrink-0" aria-hidden="true" />
            )}
            {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
          </button>
        ))}
        {collapsed ? null : (
          <p className="mt-3 px-2 text-[12px] text-ink-muted">History</p>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              aria-current={active === chat.id ? "true" : undefined}
              className={cn(
                "relative z-10 flex h-9 w-full items-center gap-2 rounded-[var(--radius-control)] px-2 text-left text-[13px]",
                active === chat.id ? "font-[590] text-ink" : "text-ink-secondary",
              )}
              onMouseEnter={onEnter}
              onClick={() => setActive(chat.id)}
            >
              <MessageSquare className="size-4 shrink-0" aria-hidden="true" />
              {collapsed ? <span className="sr-only">{chat.label}</span> : (
                <span className="truncate">{chat.label}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
