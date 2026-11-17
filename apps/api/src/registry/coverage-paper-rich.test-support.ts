import {
  RICH_NATIVE_WRITER,
  nativeProvenance,
  nativeSyncOutputSchema,
  personActor,
  richReadOutputSchema,
  richTextNodes,
} from "@workspace/domain"
import { openRichPaperClient } from "@workspace/paper-crdt"
import { eq } from "drizzle-orm"
import { expect } from "vitest"

import { paperDocs } from "../db/schema.js"
import { savedRichWord } from "../paper/native-word.test-support.js"
import { bytesOf, encoded } from "../test/paper-content.js"
import { richElement, richFragment, richText } from "../test/rich-paper.js"
import type {
  CoverageCase,
  CoverageTools,
} from "./coverage-helpers.test-support.js"

export function richPaperCases(tools: CoverageTools): CoverageCase[] {
  const { db, registry, run, undo, userId } = tools
  let richSaved: Awaited<ReturnType<typeof savedRichWord>>
  async function richDocument() {
    const [row] = await db
      .select()
      .from(paperDocs)
      .where(eq(paperDocs.id, richSaved.id))
    if (!row) throw new Error("Missing rich document")
    return row.crdtDocument
  }
  return [
    {
      name: "paper.editRich",
      arrange: async () => {
        richSaved = await savedRichWord(db, userId, "cv")
        const input = { docId: richSaved.id, writer: RICH_NATIVE_WRITER }
        expect(
          await registry.read("paper.document", input, personActor(userId))
        ).toEqual({
          id: richSaved.id,
          name: "Linh Việt cv",
          kind: "cv",
          format: "rich",
          provenance: nativeProvenance(richSaved.document),
        })
        const read = richReadOutputSchema.parse(
          await registry.read(
            "paper.readRich",
            { ...input, blockIds: ["intro"] },
            personActor(userId)
          )
        )
        expect(read.basis).toEqual(richSaved.basis)
        expect(JSON.parse(read.outline)).toEqual(
          richTextNodes(richSaved.document).map((node) => ({
            id: node.id,
            type: node.type,
            selected: node.id === "intro",
            content: node.content,
          }))
        )
      },
      act: () =>
        run("paper.editRich", {
          docId: richSaved.id,
          writer: RICH_NATIVE_WRITER,
          basis: richSaved.basis,
          edits: [
            {
              op: "replaceText",
              blockId: "intro",
              from: 0,
              to: 4,
              before: "Việt",
              text: "Việt Nam",
            },
            {
              op: "formatText",
              blockId: "intro",
              from: 0,
              to: 8,
              before: "Việt Nam",
              marks: { underline: true },
            },
          ],
        }),
      assert: async (result) => {
        expect(result.pending).toBe(false)
        expect(result.output).toMatchObject({
          docId: richSaved.id,
          format: "rich",
          revision: 1,
        })
        expect(result.reversal).toMatchObject({
          command: "paper.revertEdit",
          input: { docId: richSaved.id, writer: RICH_NATIVE_WRITER },
        })
        const expected = structuredClone(richSaved.document)
        const intro = richTextNodes(expected).find(
          (node) => node.id === "intro"
        )
        const first = intro?.content[0]
        if (!intro || !first) throw new Error("Missing introduction")
        intro.content = [
          { ...first, text: "Việt Nam", underline: true },
          { ...first, text: first.text.slice(4) },
          ...intro.content.slice(1),
        ]
        expect(await richDocument()).toEqual(expected)
      },
      undoAssert: async (result) => {
        const client = openRichPaperClient(null, {
          provenance: nativeProvenance(richSaved.document),
        })
        async function sync() {
          const sent = client.prepare()
          const synced = await run("paper.nativeSync", {
            ...sent,
            update: encoded(sent.update),
            stateVector: encoded(sent.stateVector),
            docId: richSaved.id,
            writer: RICH_NATIVE_WRITER,
          })
          const reply = nativeSyncOutputSchema.parse(synced.output)
          expect(
            client.receive(sent, {
              ...reply,
              update: bytesOf(reply.update),
              stateVector: bytesOf(reply.stateVector),
            }).failed
          ).toBe(false)
        }
        try {
          await sync()
          richText(richElement(richFragment(client.ydoc), "after")).insert(
            0,
            "Later writing "
          )
          const later = client.document()
          if (!later) throw new Error("Missing later document")
          await sync()
          expect(await richDocument()).toEqual(later)
          await undo(result)
          const expected = structuredClone(richSaved.document)
          const after = richTextNodes(expected).find(
            (node) => node.id === "after"
          )
          const written = richTextNodes(later).find(
            (node) => node.id === "after"
          )
          if (!after || !written) throw new Error("Missing later passage")
          after.content = written.content
          expect(await richDocument()).toEqual(expected)
        } finally {
          client.ydoc.destroy()
        }
      },
    },
  ]
}
