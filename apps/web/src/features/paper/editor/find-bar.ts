import type { Range } from "@workspace/domain/paper-doc"
import type { DocIndex } from "./doc-positions.ts"

import { bindToolInput } from "./input-port.ts"
import { toolButton, toolField } from "./tool-elements.ts"

export function findRanges(index: DocIndex, query: string): Range[] {
  if (!query) return []
  const literal = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = new RegExp(literal, "giu")
  return index.containers.flatMap(({ block, cell, text }) =>
    Array.from(text.matchAll(pattern), (match) => ({
      from: { block, cell, offset: match.index },
      to: { block, cell, offset: match.index + match[0].length },
    }))
  )
}

export function createFindBar(
  host: HTMLElement,
  actions: {
    changed(query: string): void
    visit(index: number): void
    replaceAll(find: string, replace: string): void
    focusEditor(): void
  }
) {
  const bar = document.createElement("section")
  bar.className = "paper-tools paper-find-bar"
  bar.setAttribute("aria-label", "Find and replace")
  bar.hidden = true
  const find = toolField("Find")
  const replacement = toolField("Replace with")
  const count = document.createElement("output")
  count.setAttribute("aria-live", "polite")
  let total = 0
  let active = -1

  function move(dir: -1 | 1) {
    if (!total) return
    active = (active + total + (active < 0 && dir < 0 ? 0 : dir)) % total
    actions.visit(active)
    updateCount()
  }

  function updateCount() {
    count.textContent = total
      ? active < 0
        ? `${total} found`
        : `${active + 1} of ${total}`
      : "No matches"
    previous.disabled = next.disabled = replace.disabled = total === 0
  }

  function open(showReplace: boolean) {
    const wasHidden = bar.hidden
    bar.hidden = false
    replaceRow.hidden = !showReplace
    if (wasHidden) {
      actions.changed(find.value)
      updateCount()
    }
    const field = showReplace && !wasHidden ? replacement : find
    field.focus()
    field.select()
  }

  function close() {
    bar.hidden = true
    actions.changed("")
    actions.focusEditor()
  }

  const previous = toolButton("Previous", () => move(-1), "Previous match")
  const next = toolButton("Next", () => move(1), "Next match")
  const replace = toolButton("Replace all", () => {
    replacement.focus({ preventScroll: true })
    actions.replaceAll(find.value, replacement.value)
  })
  const findRow = document.createElement("div")
  findRow.className = "paper-tool-row"
  findRow.append(find, toolButton("Close", close))
  const matches = document.createElement("div")
  matches.className = "paper-tool-row paper-find-matches"
  matches.append(count, previous, next)
  const replaceRow = document.createElement("div")
  replaceRow.className = "paper-tool-row"
  replaceRow.append(replacement, replace)
  bar.append(findRow, matches, replaceRow)
  host.append(bar)
  bindToolInput(
    bar,
    (event) => {
      const key = event.key.toLowerCase()
      if (event.key === "Escape") {
        event.preventDefault()
        close()
      } else if (
        (event.ctrlKey || event.metaKey) &&
        (key === "f" || key === "h")
      ) {
        event.preventDefault()
        open(key === "h")
      } else if (event.key === "Enter" && event.target === find) {
        event.preventDefault()
        move(event.shiftKey ? -1 : 1)
      }
    },
    (event) => {
      if (event.target !== find) return
      active = -1
      actions.changed(find.value)
    }
  )

  return {
    open,
    update(matches: number) {
      if (total !== matches) active = -1
      total = matches
      if (!bar.hidden) updateCount()
    },
    destroy: () => bar.remove(),
  }
}
