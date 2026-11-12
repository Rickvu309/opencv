import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  DIALOG_LAYOUT_CLASS,
  type DialogLayout,
} from "@workspace/ui/components/dialog"
import { panelFit, type Viewport } from "@workspace/ui/lib/dialog-fit"

const WINDOWS: Viewport[] = [
  { width: 390, height: 844 },
  { width: 390, height: 560 },
  { width: 600, height: 480 },
  { width: 820, height: 512 },
  { width: 1024, height: 700 },
  { width: 1440, height: 900 },
]

const APP_SOURCE = path.join(import.meta.dirname, "..")

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return entry.name.endsWith(".tsx") && !entry.name.includes(".test.")
      ? [full]
      : []
  })
}

function openingTag(source: string, start: number) {
  let depth = 0
  let quote = ""
  for (let index = start; index < source.length; index += 1) {
    const char = source[index]
    if (quote) {
      if (char === quote) quote = ""
    } else if (char === '"' || char === "`") quote = char
    else if (char === "{") depth += 1
    else if (char === "}") depth -= 1
    else if (char === ">" && depth === 0) return source.slice(start, index + 1)
  }
  throw new Error("unclosed DialogContent tag")
}

type DialogSite = {
  name: string
  layout: DialogLayout
  className: string
  hasOutsideControl: boolean
}

function dialogSites(): DialogSite[] {
  const files = sourceFiles(APP_SOURCE)
  const texts = new Map(files.map((file) => [file, readFileSync(file, "utf8")]))
  const constant = (name: string) => {
    for (const text of texts.values()) {
      const found = new RegExp(`const ${name} =\\s*"([^"]*)"`).exec(text)
      if (found) return found[1]
    }
    throw new Error(`cannot find ${name}`)
  }
  return [...texts].flatMap(([file, text]) =>
    [...text.matchAll(/<DialogContent\b/g)].map((match) => {
      const tag = openingTag(text, match.index)
      const literal = /className="([^"]*)"/.exec(tag)?.[1]
      const named = /className=\{[^}]*?\b([A-Z][A-Z0-9_]+)\b[^}]*\}/.exec(
        tag
      )?.[1]
      const body = text.slice(
        match.index + tag.length,
        text.indexOf("</DialogContent>", match.index)
      )
      return {
        name: `${path.relative(APP_SOURCE, file)}:${text.slice(0, match.index).split("\n").length}`,
        layout: (/layout="(\w+)"/.exec(tag)?.[1] ?? "dialog") as DialogLayout,
        className: literal ?? (named ? constant(named) : ""),
        hasOutsideControl: /(^|[\s"])-(right|left|top|bottom)-\d/.test(body),
      }
    })
  )
}

function fitProblems(site: DialogSite, window: Viewport) {
  return panelFit(
    `${DIALOG_LAYOUT_CLASS[site.layout]} ${site.className}`,
    window,
    { hasOutsideControl: site.hasOutsideControl }
  ).problems
}

describe("every dialog and dialog-based panel fits the window at every size", () => {
  const sites = dialogSites()

  it("finds the dialog call sites, the phone drawer and the template gallery among them", () => {
    expect(sites.length).toBeGreaterThanOrEqual(15)
    expect(
      sites.some((site) =>
        site.name.startsWith("features/app-shell/app-shell.tsx")
      )
    ).toBe(true)
    expect(sites.some((site) => site.className.includes("sm:max-w-3xl"))).toBe(
      true
    )
  })

  for (const window of WINDOWS)
    it(`at ${window.width}x${window.height} each panel stays inside, full-height panels stay full, outside controls stay visible`, () => {
      const problems = sites.flatMap((site) =>
        fitProblems(site, window).map((problem) => `${site.name} ${problem}`)
      )
      expect(problems).toEqual([])
    })
})
