import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import { coachCopy } from "./coach-copy.ts"
import { groupChats, type CoachListItem, type HistoryGroup } from "./coach-model.ts"

const ORDER: HistoryGroup[] = ["Today", "Yesterday", "Last 7 days"]

type Props = {
  chats: CoachListItem[]
  query: string
  timeZone: string
  onQuery: (value: string) => void
  onOpen: (chat: CoachListItem) => void
  onNew: () => void
}

export function CoachHistory({
  chats,
  query,
  timeZone,
  onQuery,
  onOpen,
  onNew,
}: Props) {
  const needle = query.trim().toLowerCase()
  const filtered = needle
    ? chats.filter((chat) => chat.title.toLowerCase().includes(needle))
    : chats
  const groups = groupChats(filtered, timeZone)

  return (
    <div
      data-slot="coach-history"
      role="region"
      aria-label="Chats"
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4"
    >
      <div className="flex items-center gap-2">
        <Input
          aria-label={coachCopy.searchChats}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={onNew}>
          {coachCopy.newChat}
        </Button>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{coachCopy.noChats}</p>
      ) : (
        ORDER.map((name) =>
          groups[name].length === 0 ? null : (
            <section key={name} aria-label={name} className="flex flex-col gap-1">
              <h2 className="text-xs font-medium text-muted-foreground">{name}</h2>
              {groups[name].map((chat) => (
                <Button
                  key={chat.id}
                  type="button"
                  variant="ghost"
                  className="justify-start"
                  onClick={() => onOpen(chat)}
                >
                  {chat.title}
                </Button>
              ))}
            </section>
          )
        )
      )}
    </div>
  )
}
