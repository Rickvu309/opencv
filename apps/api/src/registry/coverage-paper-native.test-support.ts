import {
  nativeProvenance,
  nativeSyncOutputSchema,
  paperPhotoRef,
  parseUserId,
  RICH_NATIVE_WRITER,
  type RichPaperDocument,
} from "@workspace/domain"
import {
  openRichPaperClient,
  type PaperClient,
  type Prepared,
} from "@workspace/paper-crdt"
import { eq } from "drizzle-orm"
import { expect } from "vitest"

import { paperDocs } from "../db/schema.js"
import { seedColumns } from "../paper/content-document.js"
import { saveFile } from "../paper/index.js"
import { png } from "../paper/photo.fixtures.js"
import { bytesOf, encoded } from "../test/paper-content.js"
import {
  richElement,
  richFragment,
  richPaper,
  richText,
} from "../test/rich-paper.js"
import {
  idOf,
  type CoverageCase,
  type CoverageTools,
} from "./coverage-helpers.test-support.js"

export function nativePaperCases(tools: CoverageTools): CoverageCase[] {
  const { db, registry, run, userId } = tools
  const paperSave = registry
    .list()
    .commands.find((command) => command.name === "paper.save")
  if (!paperSave) throw new Error("Missing Paper save command")
  let document: ReturnType<typeof richPaper> | null = null
  let client: PaperClient<RichPaperDocument> | null = null
  let docId = ""
  const sync = async (sent: Prepared) =>
    run(paperSave.name, {
      docId,
      writer: RICH_NATIVE_WRITER,
      ...sent,
      update: encoded(sent.update),
      stateVector: encoded(sent.stateVector),
    })
  const receive = (sent: Prepared, output: unknown) => {
    const reply = nativeSyncOutputSchema.parse(output)
    return client!.receive(sent, {
      ...reply,
      update: bytesOf(reply.update),
      stateVector: bytesOf(reply.stateVector),
    })
  }
  let sent: Prepared | null = null
  return [
    {
      name: paperSave.name,
      arrange: async () => {
        const photo = await saveFile({
          userId: parseUserId(userId),
          name: "portrait.png",
          mediaType: "image/png",
          bytes: Buffer.from(png),
          purpose: "avatar",
        })
        document = richPaper("letter", paperPhotoRef(photo.id))
        docId = idOf((await run("paper.create", { kind: "letter" })).output)
        await db
          .update(paperDocs)
          .set(seedColumns("letter", document!))
          .where(eq(paperDocs.id, docId))
        client = openRichPaperClient(null, {
          provenance: nativeProvenance(document!),
        })
        const pull = client.prepare()
        expect(receive(pull, (await sync(pull)).output).failed).toBe(false)
        richText(richElement(richFragment(client.ydoc), "intro")).insert(
          0,
          "Synced "
        )
        sent = client.prepare()
      },
      act: () => sync(sent!),
      assert: async (result) => {
        expect(nativeSyncOutputSchema.parse(result.output)).toMatchObject({
          provenance: nativeProvenance(document!),
          reset: false,
          stale: false,
        })
        expect(result.activityId).toBeNull()
        expect(result.reversal).toBeNull()
        expect(receive(sent!, result.output).failed).toBe(false)
        const [row] = await db
          .select()
          .from(paperDocs)
          .where(eq(paperDocs.id, docId))
        expect(row?.crdtDocument).toEqual(client!.document())
        client!.ydoc.destroy()
      },
    },
  ]
}
