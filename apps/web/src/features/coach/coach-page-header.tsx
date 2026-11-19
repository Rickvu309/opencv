import type { ReactNode } from "react"
import { SquarePen } from "lucide-react"

import {
  PageHeaderAction,
  PageHeaderActions,
} from "@workspace/ui/components/page-header"
import { WorkspaceHeader } from "@/components/workspace-header.tsx"

import "@/features/coach/design/page-header.css"

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
    <WorkspaceHeader data-surface="coach">
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
    </WorkspaceHeader>
  )
}
