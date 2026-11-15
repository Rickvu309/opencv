import {
  NATIVE_WRITER,
  nativePaperDocumentSchema,
  nativeProvenance,
  nativeSyncOutputSchema,
  paperViewSchema,
  personActor,
} from "@workspace/domain"
import { loadYDoc, seedYDoc, writeDocument } from "@workspace/paper-crdt"
import { eq } from "drizzle-orm"
import { expect } from "vitest"

import { paperDocs } from "../db/schema.js"
import { bytesOf, encoded } from "../test/paper-content.js"
import {
  idOf,
  type CoverageCase,
  type CoverageTools,
} from "./coverage-helpers.js"

export function nativePaperCases(tools: CoverageTools): CoverageCase[] {
  const { db, registry, run, userId } = tools
  const document = (text: string) =>
    nativePaperDocumentSchema.parse({
      version: 4,
      schemaRevision: 1,
      kind: "letter",
      clashes: [],
      blocks: [
        {
          id: "native-sync",
          type: "paragraph",
          content: [{ text, underline: true }],
        },
      ],
    })
  const original = document("Dear team")
  const edited = document("Synced Việt 😀")
  let input: Parameters<CoverageTools["run"]>[1]
  let docId = ""
  return [
    {
      name: "paper.nativeSync",
      arrange: async () => {
        docId = idOf((await run("paper.create", { kind: "letter" })).output)
        await db
          .update(paperDocs)
          .set({
            crdtEpoch: 1,
            crdtBase: Buffer.from(seedYDoc(original)),
            crdtDocument: original,
          })
          .where(eq(paperDocs.id, docId))
        const qualified = {
          docId,
          writer: NATIVE_WRITER,
          provenance: nativeProvenance(original),
        }
        const pulled = nativeSyncOutputSchema.parse(
          (
            await run("paper.nativeSync", {
              ...qualified,
              epoch: 0,
              update: "",
              stateVector: "",
            })
          ).output
        )
        const client = loadYDoc(bytesOf(pulled.update), [])
        try {
          input = {
            ...qualified,
            epoch: pulled.epoch,
            basedOn: pulled.revision,
            stateVector: pulled.stateVector,
            update: encoded(writeDocument(client, edited, "person")),
          }
        } finally {
          client.destroy()
        }
      },
      act: () => run("paper.nativeSync", input),
      assert: async (result) => {
        expect(nativeSyncOutputSchema.parse(result.output)).toMatchObject({
          provenance: nativeProvenance(original),
          epoch: 1,
          revision: 2,
          reset: false,
          stale: false,
        })
        expect(result.activityId).toBeNull()
        expect(result.reversal).toBeNull()
        const saved = paperViewSchema.parse(
          await registry.read(
            "paper.get",
            { docId, writer: NATIVE_WRITER },
            personActor(userId)
          )
        )
        expect(saved.paper).toEqual(edited)
      },
    },
  ]
}
