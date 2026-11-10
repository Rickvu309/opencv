import { existsSync, readdirSync, readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { PaperPackage } from "../../../../../apps/api/src/paper/package-engine.ts"

import { pagePieces } from "./canvas-edit.ts"
import { planPageChange } from "./canvas-save.ts"

const corpus =
  process.env.PAPER_CORPUS ??
  "/home/quan/tmp/opencv-paper-core/spike/safe-surface-v3/corpus"

const context = {
  docId: "cv",
  incarnation: "import-one",
  revision: "revision-one",
}

describe.skipIf(!existsSync(corpus))("admitted corpus", () => {
  it("plans one change for every editable piece and leaves the rest", async () => {
    const names = readdirSync(corpus)
      .filter((name) => name.endsWith(".docx"))
      .sort()
    let admitted = 0
    let pieces = 0
    const skipped: string[] = []
    for (const name of names) {
      let opened: Awaited<ReturnType<typeof PaperPackage.open>>
      try {
        opened = await PaperPackage.open(
          readFileSync(`${corpus}/${name}`),
          context
        )
      } catch (error) {
        skipped.push(
          `${name}: ${error instanceof Error ? error.message : "open failed"}`
        )
        continue
      }
      const keys = opened.sidecar().paragraphs.map((item) => item.key)
      const regions = opened.read().regions.map((region) => {
        const paragraph = keys[region.location.paragraph - 1]
        return paragraph ? { ...region, paragraph } : region
      })
      const rows = pagePieces(regions)
      const editable = rows.filter((row) => !row.held)
      if (editable.length === 0) continue
      admitted += 1
      const ids = rows.map((row) => row.id)
      expect(new Set(ids).size, name).toBe(ids.length)
      for (const row of editable) {
        const after = row.text === "" ? "Q" : `${row.text}Q`
        const blocks = rows.map((item) =>
          item.id === row.id
            ? { id: item.id, text: after }
            : {
                id: item.id,
                text: item.text,
                ...(item.held
                  ? {
                      held: true as const,
                      ...(item.reason ? { reason: item.reason } : {}),
                    }
                  : {}),
              }
        )
        expect(planPageChange(regions, blocks), `${name}:${row.id}`).toEqual({
          kind: "text",
          paragraph: row.paragraph,
          before: row.text,
          after,
          targetId: row.targetId,
        })
        pieces += 1
      }
    }
    expect(admitted, skipped.join("\n")).toBeGreaterThan(0)
    expect(pieces).toBeGreaterThan(0)
  })
})
