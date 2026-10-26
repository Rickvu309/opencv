import type { ReactNode } from "react"
import { cn } from "cn"

import { Button } from "./button"

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
            <Button
              key={tab.href}
              variant={current ? "secondary" : "outline"}
              size="sm"
              // render is an anchor, so Base UI must not expect a native button.
              nativeButton={false}
              aria-current={current ? "page" : undefined}
              render={<a href={tab.href} />}
              className="rounded-full"
            >
              {tab.icon}
              {tab.label}
            </Button>
          )
        })}
      </nav>
      {children}
    </div>
  )
}

export { Toolbar, type ToolbarTab }
