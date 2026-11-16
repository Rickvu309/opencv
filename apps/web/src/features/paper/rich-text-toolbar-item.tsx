import { createContext, useContext, type ReactNode } from "react"

export const ToolbarItemsContext = createContext<{
  surface: "bar" | "menu"
  visible: readonly string[]
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
    <span
      data-toolbar-item={label}
      aria-hidden={!visible || undefined}
      inert={!visible || undefined}
      className={
        visible
          ? "inline-flex shrink-0"
          : "pointer-events-none invisible absolute inline-flex shrink-0"
      }
    >
      {children}
    </span>
  )
}
