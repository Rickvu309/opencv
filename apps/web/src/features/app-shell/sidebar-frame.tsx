import type { CSSProperties, ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"
import { SidebarResizeHandle } from "@/features/app-shell/sidebar-resize-handle.tsx"
import { SidebarToggle } from "@/features/app-shell/sidebar-toggle.tsx"
import { shellCopy } from "@/features/app-shell/shell-copy.ts"
import { COLLAPSED_GUTTER } from "@/features/app-shell/sidebar-width.ts"
import type { SidebarLayout } from "@/features/app-shell/use-sidebar-layout.ts"

type Props = {
  layout: SidebarLayout
  children: ReactNode
}

export function SidebarFrame({ layout, children }: Props) {
  const { width, collapsed, peek } = layout
  const hidden = collapsed && !peek
  const style = {
    "--sidebar-width": `${width}px`,
    ...(collapsed ? { width: COLLAPSED_GUTTER } : null),
  } as CSSProperties

  return (
    <div
      data-slot="sidebar-frame"
      data-state={collapsed ? "collapsed" : "open"}
      style={style}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") layout.peekHold()
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") layout.peekLeave()
      }}
      className={cn(
        "group/frame relative z-30 shrink-0 transition-[width] duration-(--duration-panel) ease-(--ease-panel) data-[resizing=true]:not-data-[collapse-preview=true]:transition-none motion-reduce:transition-none",
        !collapsed && "w-(--sidebar-width)"
      )}
    >
      {collapsed ? (
        <div
          data-slot="sidebar-expand"
          data-pen-surface="app-shell"
          className="absolute top-3.5 left-1"
        >
          <SidebarToggle
            label={shellCopy.expandSidebar}
            direction="open"
            onClick={layout.pin}
          />
        </div>
      ) : null}
      <aside
        aria-label="Sidebar"
        inert={hidden}
        data-peek={peek}
        className={cn(
          "absolute inset-y-0 left-0 flex w-(--sidebar-width) bg-sidebar transition-[translate,box-shadow] duration-(--duration-panel) ease-(--ease-panel) group-data-[collapse-preview=true]/frame:-translate-x-[calc(100%+0.5rem)] motion-reduce:transition-none",
          collapsed && "-translate-x-[calc(100%+0.5rem)]",
          peek &&
            "inset-y-2 left-2 translate-x-0 overflow-hidden rounded-lg shadow-xl ring-1 ring-foreground/10"
        )}
      >
        {children}
        {collapsed ? null : (
          <SidebarResizeHandle
            width={width}
            onCommit={layout.setWidth}
            onCollapse={layout.collapse}
            onToggle={layout.toggle}
            onReset={layout.resetWidth}
          />
        )}
      </aside>
      {collapsed ? (
        <div
          aria-hidden="true"
          data-slot="sidebar-peek-zone"
          className="absolute inset-y-0 left-0 w-2"
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") layout.peekEnter()
          }}
          onPointerLeave={layout.peekCancel}
        />
      ) : null}
    </div>
  )
}
