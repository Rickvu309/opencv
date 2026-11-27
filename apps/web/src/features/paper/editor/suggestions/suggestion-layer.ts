import "./suggestions.css"

import type { DocCommand, Document } from "@workspace/domain/paper-doc"
import type { Layout, LineBox, PaperEngine } from "@workspace/paper-engine"

import { px } from "../painter.ts"
import { pageCommands } from "./agent-commands.ts"
import {
  displayDocument,
  mapSuggestions,
  type DisplayDocument,
  type Proposal,
  type SuggestionView,
} from "./suggestion-view.ts"

export type SuggestionPort = {
  approve(id: string): Promise<void>
  deny(id: string): Promise<void>
}

export type SuggestionHost = {
  land(commands: DocCommand[], proposals: string[]): boolean
  undo(): void
  changed(): void
}

const TOUCH_LAYOUT = "(max-width: 767px), (pointer: coarse)"
const GAP_SCREEN_PX = 41
const TOUCH_GAP_SCREEN_PX = 52
const GAP_LINE_PX = 20
const GAP_AFTER_PX = 32 / 3
const TOAST_MS = 6000

const ICONS = {
  spark: [
    "M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z",
    "M19 17v4",
    "M17 19h4",
  ],
  accept: ["M20 6 9 17l-5-5"],
  reject: ["M18 6 6 18", "m6 6 12 12"],
}

function icon(paths: string[]) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("viewBox", "0 0 24 24")
  svg.setAttribute("aria-hidden", "true")
  for (const d of paths) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute("d", d)
    svg.append(path)
  }
  return svg
}

function button(className: string, label: string, paths: string[] | null) {
  const el = document.createElement("button")
  el.type = "button"
  el.className = className
  if (paths) el.append(icon(paths))
  el.append(label)
  return el
}

function gapScreenPx() {
  return window.matchMedia(TOUCH_LAYOUT).matches
    ? TOUCH_GAP_SCREEN_PX
    : GAP_SCREEN_PX
}

const plural = (n: number) => `${n} ${n === 1 ? "change" : "changes"}`
const suggestionCount = (n: number) =>
  `${n} ${n === 1 ? "suggestion" : "suggestions"}`

export function createSuggestionLayer(
  host: HTMLElement,
  overlay: HTMLElement,
  engine: PaperEngine,
  deps: SuggestionHost
) {
  let proposals: Proposal[] = []
  let port: SuggestionPort | null = null
  let busy = false
  let cached: { doc: Document; list: Proposal[]; view: SuggestionView } | null =
    null
  let display: DisplayDocument | null = null
  let toastTimer = 0

  const strip = document.createElement("section")
  strip.className = "paper-suggest-strip"
  strip.setAttribute("aria-label", "Coach suggestions")
  strip.hidden = true
  const mark = document.createElement("span")
  mark.className = "paper-suggest-mark"
  mark.append(icon(ICONS.spark))
  const label = document.createElement("span")
  const name = document.createElement("b")
  name.textContent = "Coach"
  const count = document.createElement("span")
  count.className = "paper-suggest-count"
  label.append(name, " ", count)
  const acceptAll = button("paper-suggest-all", "Accept all", null)
  acceptAll.addEventListener("click", () =>
    decide(
      currentView().open.map(({ id }) => id),
      true
    )
  )
  const status = document.createElement("output")
  status.className = "paper-suggest-status"
  status.setAttribute("aria-live", "polite")
  strip.append(mark, label, acceptAll, status)
  host.prepend(strip)

  const style = document.createElement("style")
  host.append(style)
  const chipLayer = document.createElement("div")
  chipLayer.className = "paper-suggest-chips-layer"
  chipLayer.addEventListener("pointerdown", (event) => event.stopPropagation())
  overlay.append(chipLayer)

  const toast = document.createElement("div")
  toast.className = "paper-suggest-toast"
  toast.hidden = true
  const toastText = document.createElement("span")
  const toastUndo = button("", "Undo", null)
  toastUndo.addEventListener("click", () => {
    hideToast()
    deps.undo()
  })
  toast.append(toastText, toastUndo)
  host.append(toast)

  function hideToast() {
    toast.hidden = true
    window.clearTimeout(toastTimer)
  }

  function showToast(text: string, undoable: boolean) {
    toastText.textContent = text
    toastUndo.hidden = !undoable
    toast.hidden = false
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(hideToast, TOAST_MS)
  }

  let lastDoc: Document | null = null

  function currentView(): SuggestionView {
    const doc = lastDoc
    if (!doc) return { open: [], stale: [], lines: new Map() }
    if (!cached || cached.doc !== doc || cached.list !== proposals)
      cached = {
        doc,
        list: proposals,
        view: mapSuggestions(engine, doc, proposals),
      }
    return cached.view
  }

  async function decide(ids: string[], accept: boolean) {
    if (busy || !port || ids.length === 0) return
    busy = true
    status.textContent = ""
    paintControls()
    const settled: Proposal[] = []
    let failure = ""
    for (const id of ids) {
      const proposal = proposals.find((each) => each.id === id)
      if (!proposal) continue
      try {
        await (accept ? port.approve(id) : port.deny(id))
        settled.push(proposal)
      } catch (cause) {
        failure =
          cause instanceof Error && cause.message
            ? cause.message
            : "Coach could not apply that change."
        break
      }
    }
    busy = false
    proposals = proposals.filter((each) => !settled.includes(each))
    status.textContent = failure
    const landed = accept && settled.length > 0 ? land(settled) : false
    if (!landed) deps.changed()
    if (accept && settled.length > 0 && !landed)
      status.textContent = "Accepted. Reopen this Paper to see the change."
    if (settled.length > 0)
      showToast(
        `${accept ? "Accepted" : "Rejected"} ${plural(settled.length)}`,
        accept && landed
      )
  }

  function land(settled: Proposal[]) {
    const commands = pageCommands(
      lastDoc!,
      settled.flatMap((each) => each.commands)
    )
    return commands
      ? deps.land(
          commands,
          settled.map((each) => each.id)
        )
      : false
  }

  function paintControls() {
    const open = currentView().open.length
    strip.hidden = open === 0 && !status.textContent
    count.textContent = open ? suggestionCount(open) : "All reviewed"
    acceptAll.disabled = busy || open === 0
    for (const each of chipLayer.querySelectorAll("button"))
      each.disabled = busy
  }

  function chipsFor(id: string) {
    const found = chipLayer.querySelector<HTMLElement>(
      `[data-proposal="${CSS.escape(id)}"]`
    )
    if (found) return found
    const chips = document.createElement("div")
    chips.className = "paper-suggest-chips"
    chips.dataset.proposal = id
    const yes = button("paper-suggest-accept", "Accept", ICONS.accept)
    yes.setAttribute("aria-label", "Accept change")
    yes.addEventListener("click", () => decide([id], true))
    const no = button("paper-suggest-reject", "Reject", ICONS.reject)
    no.setAttribute("aria-label", "Reject change")
    no.addEventListener("click", () => decide([id], false))
    chips.append(yes, no)
    chipLayer.append(chips)
    return chips
  }

  function decorate(roles: DisplayDocument["roles"]) {
    const rule = (role: string) =>
      [...roles]
        .filter(([, each]) => each.role === role)
        .map(([id]) => `.paper-line[data-block="${CSS.escape(id)}"]`)
        .join(",")
    const old = rule("old")
    const added = rule("new")
    style.textContent = [
      old
        ? `:is(${old}) .paper-run:not([data-marker]){color:var(--destructive)!important;text-decoration-line:line-through;text-decoration-thickness:1.5px}`
        : "",
      added
        ? `:is(${added}) .paper-run:not([data-marker]){color:color-mix(in oklch, var(--chart-2) 50%, var(--foreground))!important;background:color-mix(in oklch, var(--chart-2) 16%, var(--background));text-decoration-line:underline;text-decoration-thickness:1.5px;text-underline-offset:3px}`
        : "",
      added ? `:is(${added}) [data-marker]{visibility:hidden}` : "",
    ].join("")
  }

  return {
    set(next: Proposal[], nextPort: SuggestionPort | null) {
      proposals = next
      port = nextPort
      status.textContent = ""
      deps.changed()
    },
    stripHeight: () => (strip.hidden ? 0 : strip.offsetHeight),
    display(doc: Document, scale: number): Document {
      lastDoc = doc
      const room = gapScreenPx() / scale - GAP_AFTER_PX
      const spacing = Math.max(0.1, room / GAP_LINE_PX)
      display = displayDocument(doc, currentView(), spacing)
      decorate(display.roles)
      paintControls()
      return display.doc
    },
    owner(block: string) {
      const role = display?.roles.get(block)
      return role && role.owner !== block ? role.owner : null
    },
    draw(layout: Layout, pitchPx: number, scale: number) {
      const roles = display?.roles ?? new Map()
      const first = new Map<string, { page: number; box: LineBox }>()
      for (const page of layout.pages)
        for (const box of page.boxes)
          if (
            box.kind === "line" &&
            roles.has(box.block) &&
            !first.has(box.block)
          )
            first.set(box.block, { page: page.index, box })
      const placed = new Set<string>()
      for (const [id, role] of roles) {
        if (role.role !== "gap") continue
        const gap = first.get(id)
        if (!gap) continue
        const text =
          first.get(`${role.owner}~${role.proposal}~new0`) ??
          first.get(role.owner)
        const x = text?.box.segments[0]?.x ?? gap.box.rect.x
        const chips = chipsFor(role.proposal)
        chips.style.transform = `translate(${px(x)}px, ${gap.page * pitchPx + px(gap.box.rect.y) + 4}px) scale(${1 / scale})`
        placed.add(role.proposal)
      }
      for (const chips of chipLayer.querySelectorAll<HTMLElement>(
        ".paper-suggest-chips"
      ))
        if (!placed.has(chips.dataset.proposal ?? "")) chips.remove()
      paintControls()
    },
    destroy() {
      hideToast()
      strip.remove()
      style.remove()
      chipLayer.remove()
      toast.remove()
    },
  }
}
