import { useLayoutEffect, useReducer, type RefObject } from "react"

import type { TextEditor } from "./rich-text-toolbar-control.tsx"

type ToolbarLayout = {
  visible: string[]
  more: boolean
  iconOnly: boolean
}

const unmeasuredLayout: ToolbarLayout = {
  visible: ["Bold", "Italic", "Underline"],
  more: true,
  iconOnly: false,
}

export function useToolbarOverflow(
  host: RefObject<HTMLDivElement | null>,
  editor: TextEditor | null
) {
  const [layout, update] = useReducer(
    (previous: ToolbarLayout, next: ToolbarLayout) =>
      previous.more === next.more &&
      previous.iconOnly === next.iconOnly &&
      previous.visible.join("\n") === next.visible.join("\n")
        ? previous
        : next,
    unmeasuredLayout
  )
  useLayoutEffect(() => {
    const row = host.current
    if (!row) return
    let active = true
    const measure = () => {
      if (!active) return
      const style = getComputedStyle(row)
      const width =
        row.getBoundingClientRect().width -
        (Number.parseFloat(style.paddingInlineStart) || 0) -
        (Number.parseFloat(style.paddingInlineEnd) || 0) -
        (Number.parseFloat(style.borderInlineStartWidth) || 0) -
        (Number.parseFloat(style.borderInlineEndWidth) || 0)
      const gap = Number.parseFloat(style.columnGap) || 0
      const items = Array.from(
        row.querySelectorAll<HTMLElement>("[data-toolbar-item]")
      )
      const pinned = Array.from(
        row.querySelectorAll<HTMLElement>("[data-toolbar-pinned]")
      )
      const more = row.querySelector<HTMLElement>("[data-toolbar-more]")
      const label = row.querySelector<HTMLElement>("[data-toolbar-more-label]")
      if (!(width > 0)) {
        update(unmeasuredLayout)
        return
      }
      if (!more || !label) return
      const entries = items.map((item, index) => ({
        label: item.dataset.toolbarItem ?? "",
        width: item.hasAttribute("data-toolbar-shrink")
          ? Number.parseFloat(getComputedStyle(item).flexBasis) ||
            item.getBoundingClientRect().width
          : item.getBoundingClientRect().width,
        minimum: item.hasAttribute("data-toolbar-shrink")
          ? Number.parseFloat(getComputedStyle(item).minWidth) || 0
          : item.getBoundingClientRect().width,
        pair: item.dataset.toolbarPair,
        index,
      }))
      const fixed = pinned.reduce(
        (sum, item) => sum + item.getBoundingClientRect().width + gap,
        -gap
      )
      const separators = row.querySelectorAll(
        "[data-toolbar-desktop-separator]"
      ).length
      const total =
        entries.reduce((sum, item) => sum + item.minimum + gap, fixed) +
        separators * (1 + gap)
      if (total <= width) {
        update({
          visible: entries.map((item) => item.label),
          more: false,
          iconOnly: false,
        })
        return
      }
      const priority = ["Bold", "Italic", "Underline"]
      entries.sort((a, b) => {
        const rank = (item: typeof a) => {
          const index = priority.indexOf(item.label)
          return index < 0
            ? priority.length +
                item.index +
                ([
                  "Paragraph style",
                  "Link",
                  "Bulleted list",
                  "Numbered list",
                  "Remove formatting",
                ].includes(item.label)
                  ? entries.length
                  : item.label === "Size and spacing"
                    ? entries.length * 2
                    : 0)
            : index
        }
        return rank(a) - rank(b)
      })
      const moreStyle = getComputedStyle(more)
      const icon = more.querySelector("svg")?.getBoundingClientRect().width ?? 0
      const fullWidth =
        (Number.parseFloat(moreStyle.borderInlineStartWidth) || 0) +
        (Number.parseFloat(moreStyle.paddingInlineStart) || 0) +
        (Number.parseFloat(moreStyle.paddingInlineEnd) || 0) +
        (Number.parseFloat(moreStyle.borderInlineEndWidth) || 0) +
        icon +
        (Number.parseFloat(moreStyle.columnGap) || 0) +
        label.getBoundingClientRect().width
      const emphasis = entries
        .filter((item) => priority.includes(item.label))
        .reduce((sum, item) => sum + item.width + gap, fixed)
      const iconOnly = emphasis + fullWidth + gap > width
      let used =
        fixed +
        (iconOnly ? more.getBoundingClientRect().height : fullWidth) +
        gap
      const visible: string[] = []
      for (const item of entries) {
        if (visible.includes(item.label)) continue
        const group = item.pair
          ? entries.filter((entry) => entry.pair === item.pair)
          : [item]
        const groupWidth = group.reduce(
          (sum, entry) => sum + entry.width + gap,
          0
        )
        if (used + groupWidth > width) {
          if (item.pair) break
          continue
        }
        visible.push(...group.map((entry) => entry.label))
        used += groupWidth
      }
      update({ visible, more: true, iconOnly })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    for (const control of row.querySelectorAll(
      "[data-toolbar-item], [data-toolbar-pinned], [data-toolbar-more], [data-toolbar-more-label]"
    ))
      observer.observe(control)
    measure()
    void document.fonts?.ready.then(measure)
    document.fonts?.addEventListener?.("loadingdone", measure)
    return () => {
      active = false
      observer.disconnect()
      document.fonts?.removeEventListener?.("loadingdone", measure)
    }
  }, [host, editor])
  return layout
}
