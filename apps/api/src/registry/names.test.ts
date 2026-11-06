import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { chatToolNameSchema, jobPriorityResource } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { installRegistry } from "./install.js"

const retiredCommandNames = ["paper.replace", "paper.restore"]

const historicReceiptFiles = new Set([
  "apps/web/src/features/coach/coach-chat.test.tsx",
  "apps/web/src/features/coach/coach-parts.test.tsx",
  "apps/web/src/features/coach/coach-parts.ts",
  "apps/web/src/features/coach/coach-receipt.test.ts",
  "apps/web/src/features/coach/coach-receipt.ts",
  "apps/web/src/features/coach/rich-receipts.tsx",
  "packages/domain/src/chat-messages.ts",
])

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..")
const scanRoots = [
  "apps/web/src",
  "apps/api/src/coach/fake.ts",
  "packages/domain/src",
]

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

function retiredReceiptName(name: string, files: Set<string>) {
  return (
    retiredCommandNames.includes(name) &&
    [...files].every((file) => historicReceiptFiles.has(file))
  )
}

function declaredResourceName(name: string, files: Set<string>) {
  return (
    name === jobPriorityResource.name &&
    [...files].every((file) => file === "packages/domain/src/resources.ts")
  )
}

function listUnknown(
  found: References,
  allowed: (name: string, files: Set<string>) => boolean
) {
  return [...found]
    .filter(([name, files]) => !allowed(name, files))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, files]) => `${name}  <- ${[...files].sort().join(", ")}`)
}

describe("a command, read or Coach tool name the registry lacks is rejected", () => {
  const listed = installRegistry().list()
  const registered = new Set(
    [...listed.commands, ...listed.queries].map((entry) => entry.name)
  )
  const referenced = referencedNames()

  it("registers every command name the web, fake coach and domain refer to", () => {
    const unknown = listUnknown(
      referenced.dotted,
      (name, files) =>
        registered.has(name) ||
        declaredResourceName(name, files) ||
        retiredReceiptName(name, files)
    )
    expect(
      unknown,
      `A name used in the web, fake coach or domain is not registered. Declare it in the packages/domain contract and bind it in the module's commands.ts or queries.ts (installed by apps/api/src/registry/install.ts), or fix the spelling at the call site. Unknown names:\n${unknown.join("\n")}`
    ).toEqual([])
  })

  it("recognizes a resource declaration without allowing it as a command", () => {
    const declaration = new Set(["packages/domain/src/resources.ts"])
    expect(declaredResourceName(jobPriorityResource.name, declaration)).toBe(
      true
    )
    expect(declaredResourceName("job.priorty", declaration)).toBe(false)
    expect(
      declaredResourceName(
        jobPriorityResource.name,
        new Set(["apps/web/src/example.ts"])
      )
    ).toBe(false)
  })

  it("registers every Coach tool name they refer to", () => {
    const unknown = listUnknown(
      referenced.tools,
      (name, files) => registered.has(name) || retiredReceiptName(name, files)
    )
    expect(
      unknown,
      `A Coach tool name used in the web, fake coach or domain is not registered. Declare the command in the packages/domain contract and bind it in its module's commands.ts (installed by apps/api/src/registry/install.ts), or fix the spelling at the call site. Unknown tool names:\n${unknown.join("\n")}`
    ).toEqual([])
  })

  it("keeps paper.replace and paper.restore off commands and Coach tools", () => {
    for (const name of retiredCommandNames) {
      expect(registered.has(name), name).toBe(false)
      expect(chatToolNameSchema.safeParse(name).success, name).toBe(false)
      const files = new Set([
        ...(referenced.dotted.get(name) ?? []),
        ...(referenced.tools.get(name) ?? []),
      ])
      expect(
        [...files].filter((file) => !historicReceiptFiles.has(file)).sort(),
        name
      ).toEqual([])
    }
  })
})
