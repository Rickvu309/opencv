import { SquarePen } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

type Props = {
  onNewChat: () => void
}

export function ChatTopBar({ onNewChat }: Props) {
  return (
    <header className="flex shrink-0 items-center justify-end gap-1 px-4 pt-3 pb-1">
      <Button type="button" variant="ghost" size="sm" onClick={onNewChat}>
        <SquarePen className="size-4" />
        New Thread
      </Button>
    </header>
  )
}
