// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { jobStageSchema } from "@workspace/domain"

import {
  ASSUMES as appUi,
  TOURED,
  jobStages,
} from "../../../../.claude/skills/verify-app-ui/scripts/lib/assumes.mjs"
import { ASSUMES as landing } from "../../../../.claude/skills/verify-landing/scripts/lib/assumes.mjs"
import { SURFACE_PATHS } from "../lib/product-paths.ts"

type Assumes = {
  folders: string[]
  files: string[]
  routes: string[]
  apiPaths: { method: string; pattern: string; source: string }[]
  selectors: string[]
  markers: { attr: string; surface: string; file: string }[]
}

const repo = fileURLToPath(new URL("../../../..", import.meta.url))
const abs = (p: string) => path.join(repo, p)
const SKILLS: [string, Assumes][] = [
  ["verify-app-ui", appUi],
  ["verify-landing", landing],
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)
      ? [full]
      : []
  })
}

const rawSources = ["apps/web/src", "packages/ui/src"]
  .flatMap((dir) => sourceFiles(abs(dir)))
  .map((file) => readFileSync(file, "utf8"))
// Markup is what a selector must find: .ts and .tsx source with its comments removed, never a stylesheet.
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<![:"'`\w])\/\/[^\n]*/g, "")
const corpus = rawSources.map(stripComments).join("\n")
const router = readFileSync(abs("apps/web/src/router.tsx"), "utf8")
const routerPaths = [...router.matchAll(/path: "([^"]+)"/g)].map((m) => m[1])
const productPaths = Object.values(SURFACE_PATHS)

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const word = (name: string) => `(?<![\\w-])${escape(name)}(?![\\w-])`

// Every id, class, attribute name and attribute value a selector names, as the markup pattern that must exist.
// A value must sit on its attribute (data-slot="empty" or data-slot={"empty"}), not appear as a bare word.
function selectorPatterns(selector: string): { label: string; re: RegExp }[] {
  const out: { label: string; re: RegExp }[] = []
  const add = (label: string, source: string) =>
    out.push({ label, re: new RegExp(source) })
  for (const m of selector.matchAll(/#([\w-]+)/g)) add(m[1]!, word(m[1]!))
  for (const m of selector.matchAll(/\.([\w-]+)/g)) add(m[1]!, word(m[1]!))
  for (const m of selector.matchAll(
    /\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g
  )) {
    if (m[2])
      add(
        `${m[1]}="${m[2]}"`,
        `${word(m[1]!)}=(?:"${escape(m[2])}"|\\{["']${escape(m[2])}["']\\})`
      )
    else add(m[1]!, word(m[1]!))
  }
  return out
}

function literals(file: string): string[] {
  const text = readFileSync(abs(file), "utf8")
  return [...text.matchAll(/`([^`]*)`|"([^"\n]*)"|'([^'\n]*)'/g)].map((m) =>
    (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, "x")
  )
}

describe.each(SKILLS)("%s assumptions", (_name, assumes) => {
  it("reads only folders and files that exist", () => {
    expect(assumes.folders.length).toBeGreaterThan(0)
    for (const folder of assumes.folders) {
      expect(existsSync(abs(folder)), folder).toBe(true)
    }
    for (const file of assumes.files) {
      expect(existsSync(abs(file)), file).toBe(true)
    }
  })

  it("visits only routes the app has", () => {
    for (const route of assumes.routes) {
      expect(
        productPaths.includes(route) || routerPaths.includes(route),
        route
      ).toBe(true)
    }
  })

  it("stubs and calls only api paths the web source builds", () => {
    for (const api of assumes.apiPaths) {
      const pattern = new RegExp(api.pattern)
      expect(
        literals(api.source).some((text) => pattern.test(text)),
        `${api.method} ${api.pattern} in ${api.source}`
      ).toBe(true)
    }
  })

  it("selects only markup the app source names", () => {
    for (const selector of assumes.selectors) {
      for (const { label, re } of selectorPatterns(selector)) {
        expect(re.test(corpus), `${label} from ${selector}`).toBe(true)
      }
    }
  })

  it("finds each marker exactly once in its file", () => {
    for (const marker of assumes.markers) {
      expect(existsSync(abs(marker.file)), marker.file).toBe(true)
      const text = readFileSync(abs(marker.file), "utf8")
      const count = text.split(marker.attr).length - 1
      expect(
        count,
        `${marker.attr} on ${marker.surface} in ${marker.file}`
      ).toBe(1)
    }
  })
})

describe("verify-app-ui", () => {
  it("marks one primary action on each toured surface, and nowhere else", () => {
    expect(appUi.markers.map((m) => m.surface).sort()).toEqual(
      [...TOURED].sort()
    )
    const attrs = new Set(appUi.markers.map((m) => m.attr))
    for (const attr of attrs) {
      const everywhere = rawSources.reduce(
        (sum, text) => sum + text.split(attr).length - 1,
        0
      )
      expect(everywhere, `${attr} in apps/web/src and packages/ui/src`).toBe(
        appUi.markers.filter((m) => m.attr === attr).length
      )
    }
  })

  it("reads the stage list the domain exports", () => {
    expect(jobStages()).toEqual(jobStageSchema.options)
  })
})
