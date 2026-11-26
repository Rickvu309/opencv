// @vitest-environment jsdom
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { act, cleanup } from "@testing-library/react"

import { endpoints } from "@/lib/requests.ts"
import { pinTestClock, TEST_NOW } from "@/test/test-clock.ts"
import { render } from "@/test/render-with-client.tsx"

import {
  PaperPrintMeasure,
  PaperPrintSheet,
  copySheetOrSkipCrossOriginAndJsdom,
  previewOf,
} from "./paper-print-sheet.tsx"
import {
  bindPrintPageCount,
  pagesFromPreviewHeight,
  printPaper,
  readPreviewPageCount,
} from "./paper-print.ts"

describe("preview page count", () => {
  it("counts one page at the A4 height and two pages past it", () => {
    expect(pagesFromPreviewHeight(0, 1123)).toBe(1)
    expect(pagesFromPreviewHeight(1123, 1123)).toBe(1)
    expect(pagesFromPreviewHeight(1124, 1123)).toBe(2)
    expect(pagesFromPreviewHeight(2246, 1123)).toBe(2)
  })

  it("reads the element height against the A4 variable", () => {
    const node = document.createElement("div")
    Object.defineProperty(node, "scrollHeight", { value: 2246 })
    expect(readPreviewPageCount(node)).toBe(2)
    expect(readPreviewPageCount(null)).toBe(1)
  })

  it("reapplies the count after layout settles and after web fonts load", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    vi.setSystemTime(TEST_NOW)
    const fontsDescriptor = Object.getOwnPropertyDescriptor(document, "fonts")
    let releaseFonts: () => void = () => {}
    const fontsReady = new Promise<void>((resolve) => {
      releaseFonts = resolve
    })
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: fontsReady },
    })
    const apply = vi.fn()
    const stop = bindPrintPageCount(apply)
    try {
      expect(apply).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(49)
      expect(apply).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(apply).toHaveBeenCalledTimes(2)
      releaseFonts()
      await fontsReady
      expect(apply).toHaveBeenCalledTimes(3)
    } finally {
      stop()
      if (fontsDescriptor) {
        Object.defineProperty(document, "fonts", fontsDescriptor)
      } else {
        Reflect.deleteProperty(document, "fonts")
      }
      pinTestClock()
    }
  })
})

const printedCv = {
  version: 3 as const,
  kind: "cv" as const,
  header: {
    id: "header",
    type: "header" as const,
    name: "Ada",
    email: "ada@verify.local",
    phone: "",
    city: "",
    linkedin: "",
  },
  blocks: [
    {
      id: "section-experience",
      type: "section" as const,
      kind: "experience" as const,
      title: "Experience",
    },
    {
      id: "role-1",
      type: "experience" as const,
      role: "Product intern",
      company: "",
      period: "2024",
      location: "",
      children: [
        {
          id: "did-1",
          type: "bullet" as const,
          content: [{ text: "Shipped the checklist" }],
          children: [],
        },
      ],
    },
  ],
  clashes: [],
}

const printedLetter = {
  version: 3 as const,
  kind: "letter" as const,
  blocks: [
    { id: "p-ada", type: "paragraph" as const, content: [{ text: "Ada" }] },
    { id: "p-one", type: "paragraph" as const, content: [{ text: "One." }] },
    { id: "p-two", type: "paragraph" as const, content: [{ text: "Two." }] },
    {
      id: "p-regards",
      type: "paragraph" as const,
      content: [{ text: "Regards," }],
    },
  ],
  clashes: [],
}

function sourceText(dir: string): string {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return [sourceText(path)]
      if (!entry.name.endsWith(".ts")) return []
      return [readFileSync(path, "utf8")]
    })
    .join("\n")
}

describe("print paper", () => {
  afterEach(() => {
    document.body.removeAttribute("data-print")
    cleanup()
    document
      .querySelectorAll("[data-paper-print], [data-paper-measure]")
      .forEach((node) => node.remove())
    vi.restoreAllMocks()
  })

  it("waits to print until the photo decode resolves", async () => {
    let release: () => void = () => {}
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    })
    const sheet = document.createElement("div")
    sheet.setAttribute("data-paper-print", "")
    const photo = document.createElement("img")
    photo.src = "https://photos.test/ada.png"
    Object.defineProperties(photo, {
      complete: { value: true },
      naturalWidth: { value: 120 },
      naturalHeight: { value: 160 },
    })
    sheet.append(photo)
    document.body.append(sheet)
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined)
    printPaper("Ada Photo")
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(print).not.toHaveBeenCalled()
    release()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(print).toHaveBeenCalledTimes(1)
    sheet.remove()
    delete (HTMLImageElement.prototype as { decode?: unknown }).decode
  })

  it("drops a cancelled print and opens one dialog on the next call", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined)
    const cancel = printPaper("Ada")
    cancel()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(print).not.toHaveBeenCalled()
    printPaper("Ada")
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(print).toHaveBeenCalledTimes(1)
  })

  it("hides placeholders in the measuring clone", () => {
    const measureRef = { current: null as HTMLDivElement | null }
    render(
      createElement(PaperPrintMeasure, {
        source: printedCv,
        templateId: "simple",
        measureRef,
      })
    )
    const clone = document
      .querySelector(".paper-print-measure")
      ?.shadowRoot?.querySelector("[data-paper-measure]")
    expect(clone).not.toBeNull()
    expect(clone?.querySelector("[data-placeholder]")).toBeNull()
    expect(clone?.querySelector("[aria-label='Company']")).toHaveAttribute(
      "hidden"
    )
    expect(clone?.querySelector("[aria-label='Summary']")).toBeNull()
  })

  it("prints no placeholder and no empty company line", () => {
    render(
      createElement(PaperPrintSheet, {
        name: "Ada",
        kind: "cv",
        source: printedCv,
        templateId: "simple",
      })
    )
    const sheet = document.querySelector(
      "[data-paper-print] .cv-template-root"
    )?.parentElement
    expect(sheet).not.toBeNull()
    expect(sheet?.innerHTML ?? "").not.toContain("Add text")
    expect(sheet?.querySelector("[aria-label='Summary']")).toBeNull()
    expect(sheet?.querySelector("[aria-label='Company']")).toHaveAttribute(
      "hidden"
    )
    expect(sheet?.textContent).toContain("Product intern")
    expect(sheet?.textContent).toContain("Shipped the checklist")
    const separator = sheet?.querySelector("[data-paper-field-separator]")
    expect(separator).toHaveAttribute("hidden")
  })

  it("prints a letter through the shared sheet, parts and paragraphs only", () => {
    render(
      createElement(PaperPrintSheet, {
        name: "Letter for Ada",
        kind: "letter",
        source: printedLetter,
        templateId: null,
      })
    )
    const sheet = document.querySelector(
      "[data-paper-print][data-paper-letter] [data-slot='letter-sheet']"
    )
    expect(sheet).not.toBeNull()
    expect(
      [...(sheet?.children ?? [])].map((node) => node.textContent)
    ).toEqual(["Ada", "One.", "Two.", "Regards,"])
    expect(sheet?.querySelector("textarea, [placeholder]")).toBeNull()
    expect(document.querySelector("[data-paper-letter] h1")).toBeNull()
  })

  it("scales the letter sheet by one ratio from 560px to A4 width", () => {
    const css = readFileSync(
      join(process.cwd(), "src/features/paper/paper-print.css"),
      "utf8"
    )
    const zoom = /\[data-slot="letter-sheet"\] \{\s*zoom: ([\d.]+);/.exec(css)
    expect(zoom).not.toBeNull()
    expect(560 * Number(zoom?.[1])).toBeCloseTo((210 / 25.4) * 96, 0)
  })

  it("keeps an entry head with its first bullets", () => {
    const css = readFileSync(
      join(process.cwd(), "src/features/paper/paper-print.css"),
      "utf8"
    )
    expect(css).toMatch(/\.cv-print-entry-head[\s\S]*break-after:\s*avoid/)
    expect(css).toMatch(/\.cv-print-entry-head[\s\S]*break-inside:\s*avoid/)
    expect(css).toMatch(/cv-print-entry\s+li:nth-child\(-n \+ 2\)/)
    expect(css).toMatch(
      /cv-print-entry\s+li:nth-last-child\(2\)[\s\S]*break-after:\s*avoid/
    )
    expect(css).toMatch(
      /cv-print-entry li:last-child[\s\S]*break-before:\s*avoid/
    )
    expect(css).toMatch(/orphans:\s*2/)
    expect(css).toMatch(/widows:\s*2/)
    expect(css).toMatch(/cv-type-section-title[\s\S]*break-after:\s*avoid/)
    expect(css).toMatch(/section:last-child[\s\S]*break-before:\s*auto/)
  })

  it("does not register a paper pdf read", () => {
    const paths = Object.values(endpoints)
      .map((value) => String(value))
      .join("\n")
    expect(paths).not.toContain("/pdf")
    const root = join(process.cwd(), "../..")
    const registry = [
      sourceText(join(root, "apps/api/src/registry")),
      sourceText(join(root, "apps/api/src/paper")),
      readFileSync(
        join(root, "packages/domain/src/paper-doc/paper-contract.ts"),
        "utf8"
      ),
      readFileSync(join(root, "packages/domain/src/queries.ts"), "utf8"),
    ].join("\n")
    expect(registry).not.toMatch(/paper\.pdf/)
    expect(registry).not.toMatch(/\/api\/paper\/[^`"'\s]*\/pdf/)
  })
})

const sectionsCv = {
  ...printedCv,
  blocks: [
    {
      id: "s-summary",
      type: "section" as const,
      kind: "summary" as const,
      title: "Summary",
    },
    {
      id: "summary",
      type: "paragraph" as const,
      content: [{ text: "Shipped a small tool" }],
    },
    {
      id: "s-activities",
      type: "section" as const,
      kind: "activities" as const,
      title: "Activities",
    },
    {
      id: "debate",
      type: "paragraph" as const,
      content: [{ text: "Debate club" }],
    },
    {
      id: "s-awards",
      type: "section" as const,
      kind: "awards" as const,
      title: "Awards",
    },
    {
      id: "dean",
      type: "paragraph" as const,
      content: [{ text: "Dean list" }],
    },
  ],
}

describe("print model of a stored CV", () => {
  it("keeps the summary, activities and awards", () => {
    const preview = previewOf(sectionsCv, "internship")
    expect(preview?.summary).toBe("Shipped a small tool")
    expect(preview).toMatchObject({
      activities: ["Debate club"],
      awards: ["Dean list"],
    })
  })
})

describe("constructed stylesheet copies", () => {
  it("skips a cross-origin sheet and a jsdom sheet that cannot be copied", () => {
    const sheet = {
      get cssRules() {
        throw new Error("Cannot access rules")
      },
    } as unknown as CSSStyleSheet
    expect(copySheetOrSkipCrossOriginAndJsdom(sheet)).toBeNull()
  })

  it("copies a readable sheet when constructed stylesheets exist", () => {
    const written: string[] = []
    class FakeSheet {
      cssRules: { cssText: string }[] = []
      replaceSync(text: string) {
        written.push(text)
        this.cssRules = text.split("\n").map((cssText) => ({ cssText }))
      }
    }
    vi.stubGlobal("CSSStyleSheet", FakeSheet)
    try {
      const sheet = {
        cssRules: [{ cssText: "p { color: black }" }],
      } as unknown as CSSStyleSheet
      const copy = copySheetOrSkipCrossOriginAndJsdom(sheet)
      expect(written).toEqual(["p { color: black }"])
      expect(copy).toBeInstanceOf(FakeSheet)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
