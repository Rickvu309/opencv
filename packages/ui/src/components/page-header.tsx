import type { ReactNode } from "react"
import { cn } from "cn"

function PageHeader({
  title,
  children,
  className,
}: {
  title: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex h-[52px] shrink-0 items-center gap-2 border-b border-border pr-4 pl-5",
        className
      )}
    >
      <h1 className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm font-medium">
        {title}
      </h1>
      {children}
    </header>
  )
}

export { PageHeader }
