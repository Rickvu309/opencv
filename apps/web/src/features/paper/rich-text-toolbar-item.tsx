import { createContext, useContext, type ReactNode } from "react"
import { FocusSafeRegion } from "@/components/focus-safe-region.tsx"

export const ToolbarItemsContext = createContext<{
  surface: "bar" | "menu"
  visible: readonly string[]
  focusFallback: () => HTMLElement | null
} | null>(null)

export function useToolbarGroup(labels: readonly string[]) {
  const layout = useContext(ToolbarItemsContext)
  return {
    "data-toolbar-group": layout ? "" : undefined,
    "aria-hidden":
      layout?.surface === "bar" &&
      !labels.some((label) => layout.visible.includes(label))
        ? true
        : undefined,
  }
}

export function ToolbarItem({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const layout = useContext(ToolbarItemsContext)
  if (!layout) return children
  const visible = layout.visible.includes(label)
  if (layout.surface === "menu")
    return visible ? null : (
      <span className="inline-flex max-w-full shrink-0 [&_button]:max-w-full">
        {children}
      </span>
    )
  return (
    <FocusSafeRegion
      data-toolbar-item={label}
      data-toolbar-shrink={label === "Font" || undefined}
      aria-hidden={!visible || undefined}
      concealed={!visible}
      focusFallback={layout.focusFallback}
      className={
        visible
          ? label === "Font"
            ? "inline-flex min-w-0 shrink basis-44 [&_button]:w-full"
            : "inline-flex shrink-0"
          : label === "Font"
            ? "pointer-events-none invisible absolute inline-flex w-44 min-w-0 shrink-0 basis-44"
            : "pointer-events-none invisible absolute inline-flex shrink-0"
      }
    >
      {children}
    </FocusSafeRegion>
  )
}
