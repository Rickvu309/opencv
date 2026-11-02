// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const srcDir = fileURLToPath(new URL("..", import.meta.url))

const SCANNED = ["features", "components", "routes"]
const SKIPPED =
  /^(?:features\/(?:landing|auth|seed|app-shell)\/|features\/paper\/cv-templates\/)/
const NOT_PRODUCT_CODE = /\.(?:test|type-test|spec|stories)\.[cm]?[jt]sx?$/

type Rule = { name: string; hit: (source: string) => boolean }

export const RULES: Rule[] = [
  { name: "a header element", hit: (source) => /<header\b/.test(source) },
  {
    name: "a copy of the header slot",
    hit: (source) => /data-slot=["']page-header["']/.test(source),
  },
  {
    name: "a hand-built breadcrumb",
    hit: (source) =>
      /aria-label\s*=\s*\{?\s*["'`][^"'`]*breadcrumb/i.test(source),
  },
  {
    name: "a bar sized and bordered in one class string",
    hit: (source) =>
      /["'`][^"'`\n]*\bh-(?:\[52px\]|13|12|11)(?![\w-])[^"'`\n]*\bborder-b\b[^"'`\n]*["'`]|["'`][^"'`\n]*\bborder-b\b[^"'`\n]*\bh-(?:\[52px\]|13|12|11)(?![\w-])[^"'`\n]*["'`]/.test(
        source
      ),
  },
  {
    name: "a chevron used as a crumb separator",
    hit: (source) =>
      (source.match(/<ChevronRight\b[^>]*>/g) ?? []).some(
        (tag) =>
          /\b(?:aria-hidden|shrink-0)\b/.test(tag) &&
          /size-(?:3\.5|\[13px\])/.test(tag)
      ),
  },
  {
    name: "a PageHeader given a title or class override",
    hit: (source) =>
      /<(?:PageHeader|WorkspaceHeader)\s+(?:[^>]*\s)?(?:title|className)=/.test(
        source
      ),
  },
]

export const PENDING_EXPIRY = "2026-11-23"

type Pending = {
  file: string
  marker: string | RegExp
  row: 2 | 3 | 4 | 5 | 6
  note: string
}

const PAPER = "Paper paused"

export const PENDING_HEADERS: Pending[] = [
  {
    file: "features/paper/paper-library.tsx",
    marker: '<h1 className="text-lg font-medium">Paper</h1>',
    row: 6,
    note: PAPER,
  },
  {
    file: "features/paper/paper-editor.tsx",
    marker: 'aria-label="Breadcrumb"',
    row: 6,
    note: PAPER,
  },
  {
    file: "features/paper/paper-letter.tsx",
    marker: 'data-slot="letter-editor-header"',
    row: 6,
    note: PAPER,
  },
  {
    file: "features/paper/paper-letter-start-page.tsx",
    marker: 'data-slot="letter-start-header"',
    row: 6,
    note: PAPER,
  },
  {
    file: "features/paper/paper-letter-drafting-page.tsx",
    marker: 'data-slot="letter-drafting-header"',
    row: 6,
    note: PAPER,
  },
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [full] : []
  })
}

export const PANEL_CHROME = ["features/coach/coach-panel-header.tsx"]

const toolFiles = SCANNED.flatMap((dir) => sourceFiles(path.join(srcDir, dir)))
  .map((file) => path.relative(srcDir, file).split(path.sep).join("/"))
  .filter((file) => !SKIPPED.test(file) && !NOT_PRODUCT_CODE.test(file))

const read = (file: string) => readFileSync(path.join(srcDir, file), "utf8")

function problems(source: string) {
  return RULES.filter((rule) => rule.hit(source)).map((rule) => rule.name)
}

function hasMarker(source: string, marker: string | RegExp) {
  return typeof marker === "string"
    ? source.includes(marker)
    : marker.test(source)
}

describe("tool headers are built on the kit PageHeader", () => {
  const pending = new Set(PENDING_HEADERS.map((entry) => entry.file))

  it("has no tool header outside the kit that is not listed as pending", () => {
    const strays = toolFiles
      .filter((file) => !pending.has(file) && !PANEL_CHROME.includes(file))
      .flatMap((file) => problems(read(file)).map((name) => `${file}: ${name}`))
    expect(
      strays,
      "Build the header from PageHeader, PageHeaderTitle and Breadcrumb in @workspace/ui. Put pen colours in the feature's design/page-header.pen.css."
    ).toEqual([])
  })

  it("lists only files that exist", () => {
    const missing = PENDING_HEADERS.filter(
      (entry) => !toolFiles.includes(entry.file)
    ).map((entry) => entry.file)
    expect(missing, "Delete the entry of a file that is gone.").toEqual([])
  })

  it("lists only panel chrome that exists", () => {
    expect(PANEL_CHROME.filter((file) => !toolFiles.includes(file))).toEqual([])
  })

  it("lists a file once", () => {
    expect(pending.size).toBe(PENDING_HEADERS.length)
  })

  it("keeps an entry only while its header is not migrated", () => {
    const migrated = PENDING_HEADERS.filter(
      (entry) => !hasMarker(read(entry.file), entry.marker)
    ).map((entry) => `${entry.file} (row ${entry.row})`)
    expect(
      migrated,
      "This header no longer has its own markup. Delete its PENDING_HEADERS entry."
    ).toEqual([])
  })

  it("keeps a pending file's own markup that the rules can see", () => {
    const unseen = PENDING_HEADERS.filter(
      (entry) =>
        !entry.file.startsWith("features/paper/paper-library") &&
        problems(read(entry.file)).length === 0
    ).map((entry) => entry.file)
    expect(
      unseen,
      "A pending header that no rule sees is invisible to the guard. Add a rule or delete the entry."
    ).toEqual([])
  })

  it("gives each entry a migration row and an unexpired date", () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(PENDING_EXPIRY).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(
      PENDING_EXPIRY >= today,
      `PENDING_HEADERS expired on ${PENDING_EXPIRY}. Migrate the listed headers.`
    ).toBe(true)
    for (const entry of PENDING_HEADERS) {
      expect([2, 3, 4, 5, 6]).toContain(entry.row)
      expect(entry.note.trim(), entry.file).not.toBe("")
      if (entry.file.startsWith("features/paper/")) {
        expect(entry.row, entry.file).toBe(6)
        expect(entry.note, entry.file).toBe(PAPER)
      } else {
        expect(entry.row, entry.file).toBeLessThan(6)
      }
    }
  })
})

describe("the header rules", () => {
  it("catch a hand-built header", () => {
    expect(problems('<header className="flex h-12">')).toContain(
      "a header element"
    )
    expect(problems('<nav aria-label="Breadcrumb">')).toContain(
      "a hand-built breadcrumb"
    )
    expect(
      problems('<div className="flex h-13 shrink-0 items-center border-b">')
    ).toContain("a bar sized and bordered in one class string")
    expect(
      problems('<div className="border-b px-5 h-[52px] items-center">')
    ).toContain("a bar sized and bordered in one class string")
    expect(
      problems('<ChevronRight aria-hidden="true" className="size-3.5" />')
    ).toContain("a chevron used as a crumb separator")
    expect(problems('<PageHeader title="Apply" />')).toContain(
      "a PageHeader given a title or class override"
    )
    expect(problems('<PageHeader className="h-12">')).toContain(
      "a PageHeader given a title or class override"
    )
  })

  it("let a kit header, a list caret and a month arrow through", () => {
    expect(
      problems(
        "<PageHeader><PageHeaderTitle>Apply</PageHeaderTitle></PageHeader>"
      )
    ).toEqual([])
    expect(problems('<ChevronRight className="size-[13px]" />')).toEqual([])
    expect(problems('<ChevronRight aria-hidden className="size-3" />')).toEqual(
      []
    )
    expect(problems('<div className="h-12 w-full rounded-lg">')).toEqual([])
  })
})
