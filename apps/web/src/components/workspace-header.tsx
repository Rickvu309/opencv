import { PanelLeft } from "lucide-react"
import type { ComponentProps } from "react"

import { Button } from "@workspace/ui/components/button"
import { Kbd } from "@workspace/ui/components/kbd"
import {
  PageHeader,
  PageHeaderAction,
  PageHeaderTitle,
} from "@workspace/ui/components/page-header"
import { useSidebarExpand } from "@/lib/sidebar-expand.tsx"

export const EXPAND_SIDEBAR_LABEL = "Expand sidebar"

function ExpandSidebarAction() {
  const { collapsed, expand } = useSidebarExpand()
  if (!collapsed) return null
  return (
    <PageHeaderAction
      label={EXPAND_SIDEBAR_LABEL}
      icon={<PanelLeft aria-hidden="true" />}
      hint={<Kbd className="ml-1.5">[</Kbd>}
      onSelect={expand}
      className="-ml-2 text-muted-foreground hover:text-foreground max-md:hidden"
      render={
        <Button type="button" variant="ghost" data-slot="sidebar-expand" />
      }
    />
  )
}

export function WorkspaceHeader({
  title,
  children,
  ...props
}: ComponentProps<typeof PageHeader>) {
  return (
    <PageHeader {...props}>
      <ExpandSidebarAction />
      {title === undefined ? null : <PageHeaderTitle>{title}</PageHeaderTitle>}
      {children}
    </PageHeader>
  )
}
