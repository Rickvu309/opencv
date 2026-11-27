import { readdirSync, readFileSync } from "node:fs"
import type { BlockId } from "@workspace/domain/paper-doc"
import { describe, expect, it } from "vitest"

import { docText } from "./collab-world.test-support.js"
import { newEngine, paperOf, textBlock } from "./engine.test-support.js"

const stockRebase =
  /import\s*\{[^}]*\b(?:receiveTransaction|rebaseSteps)\b[^}]*\}\s*from\s*["']prosemirror-collab["']/

export function usesStockRebase(source: string): boolean {
  return stockRebase.test(source)
}

describe("a pending delete never swallows text another tab already saved", () => {
  it("fires on the stock collab rebase", () => {
    expect(
      usesStockRebase(
        'import { collab, receiveTransaction } from "prosemirror-collab"'
      )
    ).toBe(true)
  })

  it("stays quiet on the collab plugin alone", () => {
    expect(usesStockRebase('import { collab } from "prosemirror-collab"')).toBe(
      false
    )
  })

  it("finds no engine file that rebases with the stock collab rebase", () => {
    const folder = new URL(".", import.meta.url)
    const offenders = readdirSync(folder)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .filter((name) =>
        usesStockRebase(readFileSync(new URL(name, folder), "utf8"))
      )
    expect(offenders).toEqual([])
  })

  it("keeps the other tab's text when a pending block delete is rebased over it", () => {
    const engine = newEngine()
    const doc = paperOf([
      textBlock("intro", { text: "Analyst" }),
      textBlock("skills", { text: "SQL" }),
    ])
    const at = { block: "skills" as BlockId, offset: 0 }
    const saved = engine.run(
      engine.load(doc, 0, "tab-a"),
      [{ op: "insertText", range: { from: at, to: at }, text: "Python " }],
      { kind: "person", actor: "p1", client: "tab-a" }
    )
    const deleting = engine.run(
      engine.load(doc, 0, "tab-b"),
      [{ op: "deleteBlock", block: "skills" as BlockId }],
      { kind: "person", actor: "p1", client: "tab-b" }
    )
    if ("refusal" in saved || "refusal" in deleting) throw new Error("refused")
    const { state, lost } = engine.receive(deleting.state, [saved.change])
    expect(lost).toEqual([])
    expect(docText(engine.read(state).doc)).toBe("AnalystPython SQL")
    expect(engine.sendable(state)).toEqual([])
  })
})
