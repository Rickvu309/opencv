import type { ReactNode } from "react"
import { cn } from "cn"

type ToolbarTab = {
  label: string
  href: string
  icon?: ReactNode
}

function Toolbar({
  tabs,
  active,
  children,
  className,
}: {
  tabs: ToolbarTab[]
  active: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      data-slot="toolbar"
      className={cn(
        "flex h-11 shrink-0 items-center gap-1.5 border-b border-border pr-3 pl-4",
        className
      )}
    >
      <nav
        aria-label="Views"
        className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
      >
        {tabs.map((tab) => {
          const current = tab.href === active
          return (
            <a
              key={tab.href}
              href={tab.href}
              aria-current={current ? "page" : undefined}
              data-slot="toolbar-link"
              className={cn(
                "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium",
                current
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground ring-1 ring-border ring-inset hover:bg-secondary"
              )}
            >
              {tab.icon}
              {tab.label}
            </a>
          )
        })}
      </nav>
      {children}
    </div>
  )
}

export { Toolbar, type ToolbarTab }
