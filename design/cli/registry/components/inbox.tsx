import { Clock3 } from "lucide-react"
import { cn } from "./cn"
import { Avatar } from "./display"

export interface Message {
  id: string
  from: string
  initials: string
  preview: string
  time: string
  unread?: boolean
  urgent?: boolean
}

/** One recruiter message per row. Unread is a dark dot and a bold sender. Urgent adds a grey clock, never a red dot. */
export function InboxRow({
  message: m,
  selected,
  onClick,
}: {
  message: Message
  selected?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-current={selected || undefined}
      className={cn(
        "rounded-row flex h-11 w-full items-center gap-3 px-4 text-left",
        selected ? "bg-active" : "hover:bg-subtle"
      )}
    >
      <span className="flex w-1.5 justify-center">
        {m.unread && (
          <span className="bg-fg size-1.5 rounded-full" aria-label="Unread" />
        )}
      </span>
      <Avatar initials={m.initials} size={22} />
      <span
        className={cn(
          "w-[140px] shrink-0 truncate",
          m.unread ? "font-semibold" : "font-medium"
        )}
      >
        {m.from}
      </span>
      <span
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 truncate",
          m.urgent || m.unread ? "text-fg" : "text-fg-2",
          m.urgent && "font-medium"
        )}
      >
        {m.urgent && (
          <Clock3 className="text-fg-2 size-[13px] shrink-0" aria-hidden />
        )}
        <span className="truncate">{m.preview}</span>
      </span>
      <span className="text-small text-fg-3">{m.time}</span>
    </button>
  )
}
