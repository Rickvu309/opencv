import type { BlockId, Document } from "@workspace/domain/paper-doc"
import { createEngine } from "@workspace/paper-engine"
import { describe, expect, it } from "vitest"

import { labDocument, labSuggestions } from "../lab-documents.ts"
import { displayDocument, mapSuggestions } from "./suggestion-view.ts"

let next = 0
const engine = createEngine({
  ids: () => `id${++next}` as BlockId,
  now: () => 0,
})

const textOf = (block: Document["content"][number] | null) =>
  block?.type === "text_block"
    ? (block.content ?? [])
        .map((run) => (run.type === "text" ? run.text : ""))
        .join("")
    : null

function typed(doc: Document, block: string, text: string): Document {
  const state = engine.load(doc, 0, "tab")
  const result = engine.run(
    state,
    [
      {
        op: "insertText",
        range: {
          from: { block: block as BlockId, offset: 0 },
          to: { block: block as BlockId, offset: 0 },
        },
        text,
      },
    ],
    { kind: "person", actor: "person", client: "tab" }
  )
  if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
  return engine.read(result.state).doc
}

describe("Coach suggestions on the page", () => {
  const doc = labDocument("en-10")
  const proposals = labSuggestions("en-10")

  it("maps each proposal to old and new lines of the open document", () => {
    const view = mapSuggestions(engine, doc, proposals)
    expect(view.stale).toEqual([])
    expect(view.open.map(({ id }) => id)).toEqual([
      "lab-proposal-1",
      "lab-proposal-2",
    ])
    const lines = [...view.lines].map(([at, each]) => ({
      at,
      lines: each.map((line) => [
        line.proposal,
        textOf(line.before),
        textOf(line.after),
      ]),
    }))
    expect(lines).toEqual([
      {
        at: "c8",
        lines: [
          [
            "lab-proposal-1",
            "Planned a move from shelf lists to a shared catalog.",
            "Moved the shelf lists into a shared catalog.",
          ],
        ],
      },
      {
        at: "c9",
        lines: [
          [
            "lab-proposal-2",
            "Compared each imported batch with the original accession records.",
            "Checked each imported batch against the accession records.",
          ],
        ],
      },
    ])
    expect(textOf(doc.content[7]!)).toBe(
      "Planned a move from shelf lists to a shared catalog."
    )
  })

  it("follows the tab's edits and drops a proposal whose text changed", () => {
    const edited = typed(doc, "c8", "Lead: ")
    const moved = typed(doc, "c4", "Note. ")
    expect(mapSuggestions(engine, edited, proposals).stale).toEqual([
      "lab-proposal-1",
    ])
    expect(mapSuggestions(engine, moved, proposals).open).toHaveLength(2)
  })

  it("lays the new line and the button gap under the struck line", () => {
    const view = mapSuggestions(engine, doc, proposals)
    const shown = displayDocument(doc, view, 1)
    const ids = shown.doc.content.map((block) => block.attrs.id).slice(6, 14)
    expect(ids).toEqual([
      "c7",
      "c8",
      "c8~lab-proposal-1~new0",
      "c8~lab-proposal-1~gap",
      "c9",
      "c9~lab-proposal-2~new0",
      "c9~lab-proposal-2~gap",
      "c10",
    ])
    expect(shown.roles.get("c8")).toEqual({
      proposal: "lab-proposal-1",
      owner: "c8",
      role: "old",
    })
    expect(displayDocument(doc, mapSuggestions(engine, doc, []), 1).doc).toBe(
      doc
    )
  })
})
