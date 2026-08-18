import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useState } from "react";
import { listNotificationsFn, markReadFn } from "@/core/notifications/queries";

export function NotificationBell() {
  const q = useQuery({ queryKey: ["notes"], queryFn: () => listNotificationsFn() });
  const [open, setOpen] = useState(false);
  const unread = q.data?.filter((n: { read_at: string | null }) => !n.read_at).length ?? 0;
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
        className="relative flex size-11 items-center justify-center rounded-[var(--radius-control)] text-ink hover:bg-surface-2"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="size-4" aria-hidden="true" />
        {unread ? (
          <span className="absolute top-1.5 right-1.5 min-w-4 rounded-[var(--radius-pill)] bg-accent px-1 text-center text-[11px] font-[510] text-on-accent tabular-nums">
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <ul
          className="absolute right-0 z-[var(--z-overlay)] mt-2 w-72 rounded-[var(--radius-container)] border border-hairline bg-surface-1 p-3 shadow-[var(--shadow-overlay)]"
          role="status"
        >
          {(q.data ?? []).length === 0 ? (
            <li className="text-[13px] text-ink-muted">No notifications yet.</li>
          ) : null}
          {(q.data ?? []).map((n: { id: string; payload: { text?: string } }) => (
            <li key={n.id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center rounded-[var(--radius-control)] px-2 text-left text-[13px] hover:bg-surface-2"
                onClick={() => void markReadFn({ data: { id: n.id } }).then(() => q.refetch())}
              >
                {n.payload?.text ?? n.id}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
