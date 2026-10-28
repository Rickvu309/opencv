// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { JOB_STAGES } from "@workspace/domain"

import {
  ASSUMES as appUi,
  jobStages,
} from "../../../../.claude/skills/verify-app-ui/scripts/lib/assumes.mjs"
import { ASSUMES as landing } from "../../../../.claude/skills/verify-landing/scripts/lib/assumes.mjs"
import { HOME_PATH, SURFACE_PATHS } from "../lib/product-paths.ts"

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
    return /\.(tsx?|css)$/.test(entry.name) && !/\.test\./.test(entry.name)
      ? [full]
      : []
  })
}

const corpus = ["apps/web/src", "packages/ui/src"]
  .flatMap((dir) => sourceFiles(abs(dir)))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n")
const router = readFileSync(abs("apps/web/src/router.tsx"), "utf8")
const routerPaths = [...router.matchAll(/path: "([^"]+)"/g)].map((m) => m[1])
const productPaths = [HOME_PATH, ...Object.values(SURFACE_PATHS)]

const appears = (name: string) =>
  new RegExp(
    `(?<![\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`
  ).test(corpus)

// Every id, class, attribute name and quoted attribute value a selector names.
function selectorTokens(selector: string): string[] {
  const tokens: string[] = []
  for (const m of selector.matchAll(/#([\w-]+)/g)) tokens.push(m[1]!)
  for (const m of selector.matchAll(/\.([\w-]+)/g)) tokens.push(m[1]!)
  for (const m of selector.matchAll(
    /\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g
  )) {
    tokens.push(m[1]!)
    if (m[2]) tokens.push(m[2])
  }
  return tokens
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
      for (const token of selectorTokens(selector)) {
        expect(appears(token), `${token} from ${selector}`).toBe(true)
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
  it("marks one primary action on each toured surface", () => {
    expect(appUi.markers.map((m) => m.surface).sort()).toEqual([
      "apply",
      "home",
      "paper",
      "pitch",
    ])
  })

  it("reads the stage list the domain exports", () => {
    expect(jobStages()).toEqual([...JOB_STAGES])
  })
})
