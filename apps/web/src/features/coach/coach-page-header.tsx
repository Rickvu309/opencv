import type { ReactNode } from "react"
import { SquarePen } from "lucide-react"

import {
  PageHeader,
  PageHeaderAction,
  PageHeaderActions,
} from "@workspace/ui/components/page-header"

import "@/features/coach/design/page-header.pen.css"

export function CoachPageHeader({
  history,
  showNewChat,
  onNewChat,
  children,
}: {
  history: ReactNode
  showNewChat: boolean
  onNewChat: () => void
  children?: ReactNode
}) {
  return (
    <PageHeader data-pen-surface="coach">
      <h1 className="sr-only">Coach</h1>
      {history}
      <PageHeaderActions>
        {showNewChat ? (
          <PageHeaderAction
            label="New chat"
            icon={<SquarePen />}
            onSelect={onNewChat}
          />
        ) : null}
        {children}
      </PageHeaderActions>
    </PageHeader>
  )
}
