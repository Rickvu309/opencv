import { personActor } from "@workspace/domain"
import { z } from "zod"
import { withDatabase } from "../db/context.js"
import { idempotency, user } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { Registry } from "./registry.js"
import { inputHash } from "./receipt.js"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it, vi } from "vitest"

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const modules = [
  "connections",
  "account",
  "chat",
  "paper",
  "job",
  "inbox",
  "coach",
]

function filesUnder(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === "eval") continue
      found.push(...filesUnder(full))
      continue
    }
    if (entry.endsWith(".ts")) found.push(full)
  }
  return found
}

describe("an import into another api module that skips its index.ts is rejected", () => {
  it("imports another product module only through index.ts", () => {
    const violations: string[] = []
    for (const file of filesUnder(srcRoot)) {
      const text = readFileSync(file, "utf8")
      const source = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true
      )
      const from: string[] = []
      const visit = (node: ts.Node) => {
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        )
          from.push(node.moduleSpecifier.text)
        ts.forEachChild(node, visit)
      }
      visit(source)
      for (const specifier of from) {
        const resolved = path.normalize(
          path.join(path.dirname(file), specifier)
        )
        const relative = path.relative(srcRoot, resolved)
        const [top, second] = relative.split(path.sep)
        if (!top || !modules.includes(top)) continue
        if (second === "index.js" || second === "index.ts") continue
        const owner = path.relative(srcRoot, file).split(path.sep)[0]
        if (owner === top) continue
        if (
          path.relative(srcRoot, file) === "generated/catalog.ts" &&
          second === "operations" &&
          path.basename(relative) === "server.js"
        )
          continue
        violations.push(`${path.relative(srcRoot, file)} -> ${relative}`)
      }
    }
    expect(
      violations,
      `Import another api module only through its index.ts (apps/api/src/<module>/index.ts); export what you need there. Offending imports:\n${violations.join("\n")}`
    ).toEqual([])
  })
})

describe("command input boundary", () => {
  it("hashes schema-parsed inputs with omitted undefined fields and stable key order", async () => {
    const { db, client } = await createMigratedTestDb()
    try {
      await db.insert(user).values({
        id: "canonical-owner",
        name: "Before",
        email: "canonical@test.local",
      })
      await withDatabase(db, async () => {
        const registry = new Registry()
        const execute = vi.fn(async (input: { a: number; b?: number }) => input)
        registry.addCommand(
          {
            name: "job.rename",
            description: "Canonical input fixture",
            input: z.object({
              a: z.number(),
              b: z.number().optional(),
              label: z.string().default("parsed"),
            }),
            coach: "auto",
            destructive: false,
            step: () => "Canonical input fixture",
            reversal: () => null,
            activity: () => null,
          },
          execute
        )
        const actor = personActor("canonical-owner")
        for (const [index, input] of [
          { a: 1, b: undefined },
          { a: 1 },
          { b: undefined, a: 1 },
        ].entries()) {
          const idempotencyKey = `canonical-${index}`
          const first = await registry.execute({
            name: "job.rename",
            input,
            actor,
            idempotencyKey,
          })
          for (const retry of [
            { a: 1 },
            { a: 1, b: undefined },
            { b: undefined, a: 1, label: "parsed" },
          ])
            await expect(
              registry.execute({
                name: "job.rename",
                input: retry,
                actor,
                idempotencyKey,
              })
            ).resolves.toMatchObject({
              pending: false,
              output: JSON.parse(JSON.stringify(first.output)),
            })
        }
        expect(execute).toHaveBeenCalledTimes(3)
        const rows = await db.select().from(idempotency)
        expect(rows).toHaveLength(3)
        expect(new Set(rows.map((row) => row.inputHash))).toEqual(
          new Set([inputHash({ a: 1, label: "parsed" })])
        )
        const request = {
          name: "job.rename",
          input: { a: 1, b: 2 },
          actor,
          idempotencyKey: "ordered",
        }
        const first = await registry.execute(request)
        await expect(
          registry.execute({ ...request, input: { b: 2, a: 1 } })
        ).resolves.toMatchObject({
          pending: false,
          output: JSON.parse(JSON.stringify(first.output)),
        })
        expect(execute).toHaveBeenCalledTimes(4)
      })
    } finally {
      await client.close()
    }
  })
})
