import { operation as saveOperation } from "@workspace/domain/operations/paper/save"
import { paperEngineBlank } from "@workspace/domain/paper-doc"
import { createEngine, fixedClock, seededIds } from "@workspace/paper-engine"
import { expect } from "vitest"

import { createPaperLog, postgresLogStore } from "../paper/log/index.js"
import {
  idOf,
  type CoverageCase,
  type CoverageTools,
} from "./coverage-helpers.test-support.js"

export function nativePaperCases(tools: CoverageTools): CoverageCase[] {
  const { registry, run, userId } = tools
  const paperSave = registry
    .list()
    .commands.find((command) => command.name === "paper.save")
  if (!paperSave) throw new Error("Missing Paper save command")
  const engine = createEngine({ ids: seededIds("registry"), now: fixedClock() })
  const log = createPaperLog({ store: postgresLogStore, engine })
  const tab = "coverage-tab"
  let docId = ""
  let written: Exclude<ReturnType<typeof engine.run>, { refusal: unknown }>
  return [
    {
      name: paperSave.name,
      arrange: async () => {
        docId = idOf((await run("paper.create", { kind: "cv" })).output)
        const blank = paperEngineBlank.blankCv()
        expect(await log.head(docId)).toEqual({ version: 0, doc: blank })
        const pos = { block: blank.content[0]!.attrs.id, offset: 0 }
        const result = engine.run(
          engine.load(blank, 0, tab),
          [{ op: "insertText", range: { from: pos, to: pos }, text: "Saved" }],
          { kind: "person", actor: userId, client: tab }
        )
        if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
        written = result
      },
      act: () =>
        run(paperSave.name, {
          docId,
          client: tab,
          base: 0,
          changes: [written.change],
        }),
      assert: async (result) => {
        expect(saveOperation.version).toBe(3)
        expect(result.output).toEqual({ ok: true, head: 1 })
        expect(result.activityId).toBeNull()
        expect(result.reversal).toBeNull()
        expect(await log.head(docId)).toEqual({
          version: 1,
          doc: engine.read(written.state).doc,
        })
      },
    },
  ]
}
