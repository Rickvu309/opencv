import assert from "node:assert/strict"
import { describe, it } from "node:test"

import fc from "fast-check"

import { paperDocumentSchema, repairPaper } from "./paper-doc/index.ts"

type Flat = { depth: number; id: string }

const BLOCK_TYPES = [
  "paragraph",
  "heading",
  "bullet",
  "numbered",
  "divider",
  "section",
  "experience",
  "education",
  "skills",
] as const

const flat = fc.array(
  fc.record({
    depth: fc.nat(5),
    id: fc.nat(8).map((n) => `n${n}`),
  }),
  { maxLength: 6 }
)

const blockArbitrary = fc.record({
  type: fc.constantFrom(...BLOCK_TYPES),
  id: fc.nat(8).map((n) => `n${n}`),
  kids: flat,
})

let words = 0

function word() {
  words += 1
  return `w${words}`
}

function items(list: Flat[]) {
  const roots: Record<string, unknown>[] = []
  const path: Record<string, unknown>[][] = [roots]
  let depth = -1
  for (const entry of list) {
    depth = Math.min(entry.depth, depth + 1)
    const item = {
      id: entry.id,
      type: "bullet",
      content: [{ text: word() }],
      children: [] as Record<string, unknown>[],
    }
    path.length = depth + 1
    path[depth]!.push(item)
    path.push(item.children)
  }
  return roots
}

function candidate(
  kind: "cv" | "letter",
  blocks: (typeof blockArbitrary extends fc.Arbitrary<infer T> ? T : never)[]
) {
  return {
    version: 3,
    kind,
    clashes: [],
    ...(kind === "cv"
      ? {
          header: {
            id: "header",
            type: "header",
            name: word(),
            email: "",
            phone: "",
            city: "",
            linkedin: "",
          },
        }
      : {}),
    blocks: blocks.map(({ type, id, kids }) => {
      switch (type) {
        case "section":
          return { id, type, kind: "summary", title: word() }
        case "heading":
          return { id, type, level: 2, content: [{ text: word() }] }
        case "paragraph":
          return { id, type, content: [{ text: word() }] }
        case "divider":
          return { id, type }
        case "bullet":
        case "numbered":
          return {
            id,
            type,
            content: [{ text: word() }],
            children: items(kids),
          }
        case "experience":
          return {
            id,
            type,
            role: word(),
            company: word(),
            period: "",
            location: "",
            children: items(kids),
          }
        case "education":
          return {
            id,
            type,
            school: word(),
            degree: word(),
            period: "",
            detail: "",
            children: items(kids),
          }
        case "skills":
          return { id, type, label: word(), items: [word()] }
      }
    }),
  }
}

describe("repairPaper", () => {
  it("turns any merged-like document into a valid one that keeps every word", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("cv" as const, "letter" as const),
        fc.array(blockArbitrary, { maxLength: 8 }),
        (kind, blocks) => {
          const raw = candidate(kind, blocks)
          const repaired = repairPaper(null, raw)
          assert.ok(repaired, "a repair exists")
          assert.ok(paperDocumentSchema.safeParse(repaired.document).success)
          const after = JSON.stringify(repaired.document)
          for (const kept of JSON.stringify(raw).match(/w\d+/g) ?? []) {
            assert.ok(after.includes(kept), `${kept} survives`)
          }
        }
      ),
      { numRuns: 300, seed: 20261105 }
    )
  })

  it("keeps a valid document exactly as it was", () => {
    fc.assert(
      fc.property(fc.array(blockArbitrary, { maxLength: 6 }), (blocks) => {
        const raw = candidate("cv", blocks)
        const repaired = repairPaper(null, raw)
        assert.ok(repaired)
        const again = repairPaper(repaired.document, repaired.document)
        assert.ok(again)
        assert.deepEqual(again.document, repaired.document)
        assert.equal(again.repairs.length, 0)
      }),
      { numRuns: 100, seed: 7 }
    )
  })
})
