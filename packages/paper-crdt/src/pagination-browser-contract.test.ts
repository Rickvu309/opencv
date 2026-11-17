import { afterEach, expect, it, vi } from "vitest"
import {
  flowPaginationSupport,
  installFlowView,
} from "./native-layout-flow-view.js"
import { flowFixture } from "./test/flow-fixture.js"
import { photoFixture } from "./test/photo-fixture.js"
import { measuredPageBreaks, type LayoutUnit } from "./measured-page-breaks.js"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it("paginates photos and text in browsers without experimental columns", () => {
  const input = flowFixture()
  input.flow.children[0]!.children.push(photoFixture())
  for (const css of [undefined, {}, { supports: () => false }]) {
    vi.stubGlobal("CSS", css)
    expect(flowPaginationSupport(input)).toEqual({
      supported: true,
      reason: null,
    })
    const units: LayoutUnit[] = [
      {
        pos: 1,
        end: 10,
        top: 96,
        bottom: 936,
        kind: "line",
        keepWithNext: false,
      },
      {
        pos: 11,
        end: 12,
        top: 936,
        bottom: 1056,
        kind: "block",
        keepWithNext: false,
      },
      {
        pos: 13,
        end: 20,
        top: 1056,
        bottom: 1116,
        kind: "row",
        keepWithNext: false,
      },
      {
        pos: 21,
        end: 22,
        top: 1116,
        bottom: 1116,
        kind: "break",
        keepWithNext: false,
      },
      {
        pos: 23,
        end: 30,
        top: 1116,
        bottom: 1140,
        kind: "line",
        keepWithNext: false,
      },
    ]
    const offsets = measuredPageBreaks(units, {
      height: 1056,
      top: 96,
      bottom: 96,
      gap: 24,
    })
    expect(offsets).toEqual([
      { pos: 11, end: 12, height: 240, kind: "block" },
      { pos: 21, end: 22, height: 900, kind: "break" },
    ])
    let shift = 0
    for (const unit of units) {
      shift += offsets.find((offset) => offset.pos === unit.pos)?.height ?? 0
      if (unit.kind === "break") continue
      const top = unit.top + shift
      const page = Math.floor(top / 1080)
      expect(top).toBeGreaterThanOrEqual(page * 1080 + 96)
      expect(unit.bottom + shift).toBeLessThanOrEqual(page * 1080 + 960)
    }
  }
})

it("clips an oversized row to one page content box while retaining scroll access", async () => {
  vi.stubGlobal("CSS", { escape: (id: string) => id, supports: () => false })
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  })
  const input = flowFixture()
  const section = input.flow.children[0]!
  const capacity =
    (section.page.height - section.page.top - section.page.bottom) / 15
  const host = document.createElement("div")
  host.className = "paper-rich-sheet"
  host.innerHTML =
    '<div data-paper-layout="paperFlowSection" data-paper-id="section-1"><div data-paper-wrap-slot><div data-paper-layout="paperRow"><div></div></div></div></div>'
  const row = host.querySelector<HTMLElement>('[data-paper-layout="paperRow"]')!
  vi.spyOn(row.firstElementChild!, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 96, 600, capacity + 100)
  )
  const frame = document.createElement("div")
  frame.style.padding = "0px"
  frame.append(host)
  document.body.append(frame)
  const view = installFlowView(
    host,
    () => input,
    () => {}
  )
  try {
    await new Promise(requestAnimationFrame)
    expect(host.dataset.paperPagination).toBe("true")
    expect(row.dataset.paperOversizedRow).toBe("true")
    expect(row.tabIndex).toBe(0)
    expect(row.getAttribute("aria-label")).toContain(
      "Scroll to read all content"
    )
    expect(host.previousElementSibling?.textContent).toContain(
      "height:var(--paper-column-height);overflow:auto"
    )
  } finally {
    view.destroy()
    frame.remove()
  }
})
