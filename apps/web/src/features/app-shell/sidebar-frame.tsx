import type { CSSProperties, ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"
import { SidebarResizeHandle } from "@/features/app-shell/sidebar-resize-handle.tsx"
import { FocusSafeRegion } from "@/components/focus-safe-region.tsx"
import { pageFocusTarget } from "@/features/app-shell/sidebar-focus.ts"
import type { SidebarLayout } from "@/features/app-shell/use-sidebar-layout.ts"

type Props = {
  layout: SidebarLayout
  children: ReactNode
}

export function SidebarFrame({ layout, children }: Props) {
  const { width, collapsed, peek } = layout
  const hidden = collapsed && !peek
  const style = { "--sidebar-width": `${width}px` } as CSSProperties

  return (
    <div
      data-slot="sidebar-frame"
      data-state={collapsed ? "collapsed" : "open"}
      data-mode={layout.mode}
      data-instant={layout.instant ? "true" : "false"}
      style={style}
      className={cn(
        "group/frame peer/frame relative z-30 shrink-0 data-[instant=true]:transition-none data-[resizing=true]:not-data-[collapse-preview=true]:transition-none",
        collapsed ? "w-0" : "w-(--sidebar-width)"
      )}
    >
      <FocusSafeRegion
        as="aside"
        concealed={hidden}
        focusFallback={pageFocusTarget}
        aria-label="Sidebar"
        data-peek={peek}
        {...layout.contentProps}
        className={cn(
          "absolute inset-y-0 left-0 flex w-(--sidebar-width) bg-sidebar transition-[translate,box-shadow] duration-(--duration-panel) ease-(--ease-panel) group-data-[collapse-preview=true]/frame:-translate-x-[calc(100%+0.5rem)] group-data-[instant=true]/frame:transition-none motion-reduce:transition-none",
          collapsed && "-translate-x-[calc(100%+0.5rem)]",
          peek &&
            "top-14 bottom-2 left-2 translate-x-0 overflow-hidden rounded-lg shadow-xl ring-1 ring-foreground/10"
        )}
      >
        {children}
        {collapsed ? null : (
          <SidebarResizeHandle
            width={width}
            onCommit={layout.setWidth}
            onCollapse={layout.dragCollapse}
            onDragStart={layout.dragStart}
            onDragCancel={layout.dragCancel}
            onToggle={layout.toggle}
            onReset={layout.resetWidth}
          />
        )}
      </FocusSafeRegion>
      {collapsed ? (
        <div
          aria-hidden="true"
          data-slot="sidebar-peek-zone"
          className="absolute inset-y-0 left-0 w-2"
          {...layout.triggerProps}
        />
      ) : null}
    </div>
  )
}
