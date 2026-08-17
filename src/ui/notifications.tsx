import { useQuery } from "@tanstack/react-query";
import { listNotificationsFn, markReadFn } from "@/core/notifications/queries";
import { useState } from "react";

export function NotificationBell() {
  const q = useQuery({ queryKey: ["notes"], queryFn: () => listNotificationsFn() });
  const [open, setOpen] = useState(false);
  const unread = q.data?.filter((n: { read_at: string | null }) => !n.read_at).length ?? 0;
  return (
    <div className="relative">
      <button type="button" aria-label="Notifications" onClick={() => setOpen((o) => !o)}>
        Bell{unread ? ` (${unread})` : ""}
      </button>
      {open ? (
        <ul className="absolute right-0 mt-2 w-72 rounded-[var(--radius-card)] border border-border bg-background p-3 shadow">
          {(q.data ?? []).length === 0 ? <li>No notifications yet.</li> : null}
          {(q.data ?? []).map((n: { id: string; payload: { text?: string } }) => (
            <li key={n.id}>
              <button
                type="button"
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
