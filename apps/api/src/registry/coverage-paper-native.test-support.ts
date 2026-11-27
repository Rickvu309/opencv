import { parseUserId } from "@workspace/domain/kernel"
import { operation as saveOperation } from "@workspace/domain/operations/paper/save"
import {
  nativeProvenance,
  nativeSyncOutputSchema,
  paperEngineBlank,
  paperPhotoRef,
  RICH_NATIVE_WRITER,
  type RichPaperDocument,
} from "@workspace/domain/paper-doc"
import { createEngine, fixedClock, seededIds } from "@workspace/paper-engine"
import {
  openRichPaperClient,
  type PaperClient,
  type Prepared,
} from "@workspace/paper-crdt"
import { eq } from "drizzle-orm"
import { expect } from "vitest"

import { paperDocs } from "../db/schema.js"
import { seedColumns } from "../paper/content/content-document.js"
import { saveFile } from "../paper/index.js"
import { createPaperLog, postgresLogStore } from "../paper/log/index.js"
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

        expect(saveOperation.version).toBe(3)
        const engineId = idOf(
          (await run("paper.create", { kind: "cv" })).output
        )
        const engine = createEngine({
          ids: seededIds("registry"),
          now: fixedClock(),
        })
        const log = createPaperLog({ store: postgresLogStore, engine })
        const blank = paperEngineBlank.blankCv()
        expect(await log.head(engineId)).toEqual({ version: 0, doc: blank })
        const tab = "coverage-tab"
        const pos = { block: blank.content[0]!.attrs.id, offset: 0 }
        const written = engine.run(
          engine.load(blank, 0, tab),
          [{ op: "insertText", range: { from: pos, to: pos }, text: "Saved" }],
          { kind: "person", actor: userId, client: tab }
        )
        if ("refusal" in written)
          throw new Error(JSON.stringify(written.refusal))
        const saved = await run(paperSave.name, {
          docId: engineId,
          client: tab,
          base: 0,
          changes: [written.change],
        })
        expect(saved.output).toEqual({ ok: true, head: 1 })
        expect(saved.activityId).toBeNull()
        expect(saved.reversal).toBeNull()
        expect(await log.head(engineId)).toEqual({
          version: 1,
          doc: engine.read(written.state).doc,
        })
      },
    },
  ]
}
