import { afterEach, expect, it, vi } from "vitest"
import { flowSectionSchema } from "@workspace/domain/internal/paper-presentation"
import {
  flowPaginationSupport,
  installFlowView,
} from "./native-layout-flow-view.js"
import { flowFixture } from "./test/flow-fixture.js"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it.each([
  ["Letter", 15840, false],
  ["A4", 16838, false],
  ["Letter on the rich sheet", 15840, true],
] as const)(
  "paginates table rows inside %s margins and bounds an oversized row to its own page",
  async (_, pageHeight, sheet) => {
    vi.stubGlobal("CSS", { supports: () => true, escape: (id: string) => id })
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
    section.page = flowSectionSchema.parse({
      ...section,
      page: { ...section.page, height: pageHeight },
    }).page
    const printable = (pageHeight - section.page.top - section.page.bottom) / 15
    const host = document.createElement("div")
    host.innerHTML =
      '<div data-paper-layout="paperFlowSection" data-paper-id="section-1"><div data-paper-wrap-slot><div data-paper-layout="paperRow"><div></div></div></div></div>'
    const row = host.querySelector<HTMLElement>(
      '[data-paper-layout="paperRow"]'
    )!
    const content = row.firstElementChild!
    const anchor = document.createElement("div")
    anchor.className = "paper-table-anchor"
    row.prepend(anchor)
    const frame = document.createElement("div")
    if (sheet) {
      host.classList.add("paper-rich-sheet")
      Object.defineProperty(frame, "clientWidth", { value: 1400 })
      frame.style.padding = "0px"
      frame.append(host)
      document.body.append(frame)
    } else document.body.append(host)
    const bounds = vi
      .spyOn(content, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(0, 0, 300, printable + 100))
    const view = installFlowView(
      host,
      () => input,
      () => {}
    )
    try {
      await new Promise(requestAnimationFrame)
      expect(flowPaginationSupport(input)).toEqual({
        supported: true,
        reason: null,
      })
      expect(host.dataset.paperPagination).toBe("true")
      expect(row.dataset.paperOversizedRow).toBe("true")
      expect(row.getAttribute("tabindex")).toBe("0")
      expect(row.getAttribute("aria-label")).toBe(
        "Table row taller than a page. Scroll to read all content."
      )
      const rules = host.previousElementSibling?.textContent
      expect(rules).toContain("paperRow]{break-inside:avoid")
      expect(rules).toContain(
        "paper-oversized-row=true]{height:var(--paper-column-height);overflow:auto"
      )
      expect(rules).not.toContain("data-paper-reflow")
      if (sheet) expect(host.hasAttribute("data-paper-reflow")).toBe(false)
      bounds.mockReturnValue(new DOMRect(0, 0, 300, printable - 10))
      view.schedule()
      await new Promise(requestAnimationFrame)
      expect(row.dataset.paperOversizedRow).toBe("false")
      expect(row.hasAttribute("tabindex")).toBe(false)
    } finally {
      view.destroy()
      host.remove()
      frame.remove()
    }
  }
)

it("keeps a tall row paginated while the same rich sheet scales", async () => {
  vi.stubGlobal("CSS", { supports: () => true, escape: (id: string) => id })
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
  const host = document.createElement("div")
  host.classList.add("paper-rich-sheet")
  host.innerHTML =
    '<div data-paper-layout="paperFlowSection" data-paper-id="section-1"><div data-paper-wrap-slot><div data-paper-layout="paperRow"><div></div></div></div></div>'
  const row = host.querySelector<HTMLElement>('[data-paper-layout="paperRow"]')!
  vi.spyOn(row.firstElementChild!, "getBoundingClientRect").mockReturnValue(
    new DOMRect(
      0,
      0,
      300 * (400 / (input.presentation.page.width / 15)),
      2000 * (400 / (input.presentation.page.width / 15))
    )
  )
  const frame = document.createElement("div")
  Object.defineProperty(frame, "clientWidth", { value: 400 })
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
    expect(host.hasAttribute("data-paper-reflow")).toBe(false)
    expect(host.dataset.paperPagination).toBe("true")
    expect(row.dataset.paperOversizedRow).toBe("true")
    expect(row.getAttribute("tabindex")).toBe("0")
    expect(row.getAttribute("aria-label")).toContain("taller than a page")
  } finally {
    view.destroy()
    frame.remove()
  }
})

it("drops blank pages once a tall row fits on a page again", async () => {
  vi.stubGlobal("CSS", { supports: () => true, escape: (id: string) => id })
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
  const page = input.presentation.page
  const section = input.flow.children[0]!.page
  const printable = (section.height - section.top - section.bottom) / 15
  const pitch = page.height / 15 + 24
  const host = document.createElement("div")
  host.classList.add("paper-rich-sheet")
  host.innerHTML =
    '<div class="bn-block-group"><div data-paper-layout="paperFlowSection" data-paper-id="section-1"><div data-paper-wrap-slot><div data-paper-layout="paperRow" data-paper-oversized-row="true"><div></div></div></div></div></div>'
  const row = host.querySelector<HTMLElement>('[data-paper-layout="paperRow"]')!
  const rowContent = vi
    .spyOn(row.firstElementChild!, "getBoundingClientRect")
    .mockReturnValue(new DOMRect(0, 0, 300, printable * 3))
  vi.spyOn(
    host.querySelector<HTMLElement>(".bn-block-group")!,
    "getBoundingClientRect"
  ).mockImplementation(() =>
    row.dataset.paperOversizedRow === "true"
      ? new DOMRect(0, 0, 300, pitch * 4)
      : new DOMRect(0, 0, 300, pitch / 2)
  )
  const frame = document.createElement("div")
  Object.defineProperty(frame, "clientWidth", { value: 1400 })
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
    expect(row.dataset.paperOversizedRow).toBe("true")
    expect(host.style.minHeight).toBe(`${5 * pitch - 24}px`)
    rowContent.mockReturnValue(new DOMRect(0, 0, 300, printable - 10))
    view.schedule()
    await new Promise(requestAnimationFrame)
    expect(row.dataset.paperOversizedRow).toBe("false")
    expect(host.style.minHeight).toBe(`${pitch - 24}px`)
    rowContent.mockReturnValue(new DOMRect(0, 0, 300, printable * 3))
    view.schedule()
    await new Promise(requestAnimationFrame)
    expect(row.dataset.paperOversizedRow).toBe("true")
    expect(host.style.minHeight).toBe(`${5 * pitch - 24}px`)
  } finally {
    view.destroy()
    frame.remove()
  }
})
