// @vitest-environment jsdom
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { act, cleanup } from "@testing-library/react"

import { endpoints } from "@/lib/requests.ts"
import { render } from "@/test/render-with-client.tsx"

import { PaperPrintSheet } from "./paper-print-sheet.tsx"
import {
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
})

const emptyPrint = {
  templateId: "internship" as const,
  name: "Ada",
  headline: "",
  contact: { email: "ada@verify.local", phone: "", location: "" },
  summary: "",
  experience: [
    {
      role: "Product intern",
      company: "",
      period: "2024",
      bullets: ["Shipped the checklist"],
    },
  ],
  education: [],
  skills: [],
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
    let release = () => undefined
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    })
    const sheet = document.createElement("div")
    sheet.setAttribute("data-paper-print", "")
    sheet.append(document.createElement("img"))
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

  it("prints no placeholder and no empty company line", () => {
    render(
      createElement(PaperPrintSheet, {
        name: "Ada",
        kind: "cv",
        source: emptyPrint,
        templateId: "simple",
      })
    )
    const sheet = document.querySelector(
      "[data-paper-print] .cv-template-root"
    )?.parentElement
    expect(sheet).not.toBeNull()
    expect(sheet?.innerHTML ?? "").not.toContain("Add text")
    expect(sheet?.querySelector("[aria-label='Summary']")).toHaveAttribute(
      "hidden"
    )
    expect(sheet?.querySelector("[aria-label='Company']")).toHaveAttribute(
      "hidden"
    )
    expect(sheet?.textContent).toContain("Product intern")
    expect(sheet?.textContent).toContain("Shipped the checklist")
    const dot = [...(sheet?.querySelectorAll("span") ?? [])].find(
      (node) => node.textContent?.trim() === "·"
    )
    expect(dot).toHaveAttribute("hidden")
  })

  it("keeps an entry head with its first bullets", () => {
    const css = readFileSync(
      join(process.cwd(), "src/features/paper/paper-print.css"),
      "utf8"
    )
    expect(css).toMatch(/\.cv-print-entry-head[\s\S]*break-after:\s*avoid/)
    expect(css).toMatch(/\.cv-print-entry-head[\s\S]*break-inside:\s*avoid/)
    expect(css).toMatch(/cv-print-entry li:nth-child\(-n \+ 2\)/)
    expect(css).toMatch(/cv-print-entry li:nth-last-child\(2\)[\s\S]*break-after:\s*avoid/)
    expect(css).toMatch(/cv-print-entry li:last-child[\s\S]*break-before:\s*avoid/)
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
      readFileSync(join(root, "packages/domain/src/paper-contract.ts"), "utf8"),
      readFileSync(join(root, "packages/domain/src/queries.ts"), "utf8"),
      readFileSync(
        join(root, "packages/domain/src/contract-commands.ts"),
        "utf8"
      ),
    ].join("\n")
    expect(registry).not.toMatch(/paper\.pdf/)
    expect(registry).not.toMatch(/\/api\/paper\/[^`"'\s]*\/pdf/)
  })
})
