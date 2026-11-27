import {
  isSafeHref,
  type Pos,
  type Range,
  type Run,
  type SafeHref,
} from "@workspace/domain/paper-doc"

import { bindToolInput } from "./input-port.ts"
import { placePopover, toolButton, toolField } from "./tool-elements.ts"

export type PaperLink = { href: string; range: Range }

export function linkAt(runs: readonly Run[], pos: Pos): PaperLink | null {
  const links: { href: string; from: number; to: number }[] = []
  let offset = 0
  for (const run of runs) {
    const from = offset
    offset += run.type === "text" ? run.text.length : 1
    if (run.type !== "text") continue
    const link = run.marks?.find((mark) => mark.type === "link")
    if (!link) continue
    const href = link.attrs.href
    const previous = links.at(-1)
    if (previous?.href === href && previous.to === from) previous.to = offset
    else links.push({ href, from, to: offset })
  }
  const link =
    links.find(({ from, to }) => from <= pos.offset && pos.offset < to) ??
    links.find(({ to }) => to === pos.offset)
  if (!link) return null
  return {
    href: link.href,
    range: {
      from: { ...pos, offset: link.from },
      to: { ...pos, offset: link.to },
    },
  }
}

export function createLinkBubble(
  host: HTMLElement,
  actions: {
    set(range: Range, href: SafeHref | null, text?: string): boolean
    focusEditor(): void
  }
) {
  const bubble = document.createElement("div")
  bubble.className = "paper-tools paper-link-bubble"
  bubble.setAttribute("role", "group")
  bubble.setAttribute("aria-label", "Link")
  bubble.hidden = true
  const summary = document.createElement("div")
  summary.className = "paper-tool-row"
  const edit = document.createElement("div")
  edit.className = "paper-tool-row"
  edit.hidden = true

  const open = document.createElement("a")
  open.textContent = "Open link"
  open.target = "_blank"
  open.rel = "noopener noreferrer"
  const url = toolField("Link URL")
  url.inputMode = "url"
  const display = toolField("Link text")
  const error = document.createElement("div")
  error.className = "paper-tool-error"
  error.setAttribute("role", "status")
  let link: PaperLink | null = null
  let editing: Range | null = null

  function render() {
    bubble.hidden = !editing && !link
    summary.hidden = !!editing
    edit.hidden = !editing
    if (link) open.href = link.href
    else open.removeAttribute("href")
  }

  function begin(range: Range, href: string, needsText: boolean) {
    editing = range
    url.value = href
    display.value = ""
    display.hidden = !needsText
    clearError()
    render()
    url.focus({ preventScroll: true })
    url.select()
  }

  function clearError() {
    url.removeAttribute("aria-invalid")
    display.removeAttribute("aria-invalid")
    error.textContent = ""
  }

  function close() {
    editing = null
    clearError()
    render()
    actions.focusEditor()
  }

  function apply() {
    if (!editing) return
    const href = url.value.trim()
    const text = display.hidden ? undefined : display.value.trim()
    if (!isSafeHref(href)) {
      error.textContent = "Enter an http, https, or mailto URL."
      url.setAttribute("aria-invalid", "true")
      url.focus({ preventScroll: true })
      return
    }
    if (text === "") {
      error.textContent = "Enter the text the link should display."
      display.setAttribute("aria-invalid", "true")
      display.focus({ preventScroll: true })
      return
    }
    if (actions.set(editing, href, text)) close()
  }

  const editLink = toolButton("Edit link", () => {
    if (link) begin(link.range, link.href, false)
  })
  const remove = toolButton("Remove link", () => {
    if (link && actions.set(link.range, null)) close()
  })
  summary.append(open, editLink, remove)
  edit.append(
    display,
    url,
    toolButton("Apply", apply),
    toolButton("Cancel", close)
  )
  bubble.append(summary, edit, error)
  host.append(bubble)
  bindToolInput(
    bubble,
    (event) => {
      if (event.key === "Escape") {
        event.preventDefault()
        close()
      } else if (
        event.key === "Enter" &&
        (event.target === url || event.target === display)
      ) {
        event.preventDefault()
        apply()
      }
    },
    clearError
  )

  return {
    begin,
    dismiss() {
      if (!editing) return
      editing = null
      clearError()
      render()
    },
    update(active: PaperLink | null, x: number, y: number) {
      link = active
      placePopover(bubble, x, y, 336)
      render()
    },
    destroy: () => bubble.remove(),
  }
}
