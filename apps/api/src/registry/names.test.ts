import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { installRegistry } from "./install.js"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..")
const scanRoots = [
  "apps/web/src",
  "apps/api/src/coach/fake.ts",
  "packages/domain/src",
]

const LEGACY: Record<string, string> = {
  "threads.create": "compat threads, deleted with apps/api/src/compat",
  "threads.rename": "compat threads, deleted with apps/api/src/compat",
  "threads.delete": "compat threads, deleted with apps/api/src/compat",
  "threads.postMessage": "compat threads, deleted with apps/api/src/compat",
  "paper.updateContent":
    "receipt kind stored in chat_messages.parts, renamed with the Coach stream contract",
  "paper.createDoc":
    "receipt kind stored in chat_messages.parts, renamed with the Coach stream contract",
  "apply.moveCard":
    "receipt kind stored in chat_messages.parts, renamed with the Coach stream contract",
}

const prefixes =
  "chat|paper|job|inbox|profile|account|notify|actions|activity|coach|threads|apply|pitch"
const dotted = new RegExp(
  `["'\`/]((?:${prefixes})\\.[a-z][A-Za-z]+)["'\`]`,
  "g"
)
const tool = new RegExp(`["'\`]((?:${prefixes})_[a-z][A-Za-z]+)["'\`]`, "g")
const fileExtension = /\.(ts|tsx|js|json|css|webp|png|svg)$/

function sourceFiles(path: string): string[] {
  if (statSync(path).isFile()) return /\.tsx?$/.test(path) ? [path] : []
  return readdirSync(path).flatMap((entry) => sourceFiles(join(path, entry)))
}

type References = Map<string, Set<string>>

function referencedNames(): { dotted: References; tools: References } {
  const dottedNames: References = new Map()
  const toolNames: References = new Map()
  const add = (found: References, name: string, file: string) => {
    if (fileExtension.test(name)) return
    const files = found.get(name) ?? new Set<string>()
    files.add(file)
    found.set(name, files)
  }
  for (const root of scanRoots) {
    for (const file of sourceFiles(join(repoRoot, root))) {
      const text = readFileSync(file, "utf8")
      const rel = relative(repoRoot, file)
      for (const m of text.matchAll(dotted)) add(dottedNames, m[1]!, rel)
      for (const m of text.matchAll(tool))
        add(toolNames, m[1]!.replace("_", "."), rel)
    }
  }
  return { dotted: dottedNames, tools: toolNames }
}

function listUnknown(found: References, allowed: (name: string) => boolean) {
  return [...found]
    .filter(([name]) => !allowed(name))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, files]) => `${name}  <- ${[...files].sort().join(", ")}`)
}

describe("registry names", () => {
  const listed = installRegistry().list()
  const registered = new Set(
    [...listed.commands, ...listed.queries].map((entry) => entry.name)
  )
  const referenced = referencedNames()

  it("registers every command name the web, fake coach and domain refer to", () => {
    const unknown = listUnknown(
      referenced.dotted,
      (name) => registered.has(name) || name in LEGACY
    )
    expect(unknown, unknown.join("\n")).toEqual([])
  })

  it("registers every Coach tool name they refer to, with no LEGACY exceptions", () => {
    const unknown = listUnknown(referenced.tools, (name) =>
      registered.has(name)
    )
    expect(unknown, unknown.join("\n")).toEqual([])
  })

  it("keeps a LEGACY entry only while something still refers to it", () => {
    const stale = Object.keys(LEGACY).filter(
      (name) => !referenced.dotted.has(name)
    )
    expect(stale).toEqual([])
  })
})
