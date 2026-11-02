import type { CSSProperties, ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"
import { SidebarResizeHandle } from "@/features/app-shell/sidebar-resize-handle.tsx"
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
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") layout.peekLeave()
      }}
      className={cn(
        "group/frame relative z-30 shrink-0 transition-[width] duration-(--duration-panel) ease-(--ease-panel) data-[resizing=true]:transition-none motion-reduce:transition-none",
        !collapsed && "w-(--sidebar-width)"
      )}
    >
      <aside
        aria-label="Sidebar"
        inert={hidden}
        data-peek={peek}
        className={cn(
          "absolute inset-y-0 left-0 flex w-(--sidebar-width) bg-sidebar transition-transform duration-(--duration-panel) ease-(--ease-panel) group-data-[resizing=true]/frame:transition-none motion-reduce:transition-none",
          collapsed && "-translate-x-full",
          peek && "translate-x-0 border-e border-sidebar-border shadow-lg"
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
      {hidden ? (
        <div
          aria-hidden="true"
          data-slot="sidebar-peek-zone"
          className="absolute inset-y-0 left-0 w-2"
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") layout.peekEnter()
          }}
        />
      ) : null}
    </div>
  )
}
