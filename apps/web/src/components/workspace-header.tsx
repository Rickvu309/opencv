import type { ComponentProps } from "react"

import {
  PageHeader,
  PageHeaderTitle,
} from "@workspace/ui/components/page-header"

export function WorkspaceHeader({
  title,
  children,
  ...props
}: ComponentProps<typeof PageHeader>) {
  return (
    <PageHeader {...props}>
      {title === undefined ? null : <PageHeaderTitle>{title}</PageHeaderTitle>}
      {children}
    </PageHeader>
  )
}
