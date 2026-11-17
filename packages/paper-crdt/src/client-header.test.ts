import {
  blankCv,
  paperNodeSpecs,
  paperPlainText,
  richTextSchema,
  type CvPaper,
} from "@workspace/domain"
import * as Y from "yjs"
import { describe, expect, it } from "vitest"
import { openPaperClient } from "./client.js"
import { writeAsEditor } from "./editor-write.js"
import { seedYDoc, writeDocument } from "./ydoc.js"

function contact(
  base: CvPaper,
  fields: { name?: string; email?: string }
): CvPaper {
  return {
    ...structuredClone(base),
    header: { ...(base.header ?? paperNodeSpecs.header.blank()), ...fields },
  }
}

function withoutHeader(base: CvPaper): CvPaper {
  const copy = structuredClone(base)
  delete copy.header
  return copy
}

function receive(
  base: CvPaper,
  ours: CvPaper,
  theirs: CvPaper,
  reset: boolean
) {
  const seed = seedYDoc(base)
  const server = new Y.Doc()
  const empty = new Y.Doc()
  Y.applyUpdate(server, seed)
  const known = Y.encodeStateVector(server)
  const client = openPaperClient({
    epoch: 1,
    revision: 1,
    server: seed,
    pending: Y.encodeStateAsUpdate(empty),
  })
  try {
    writeAsEditor(client.ydoc, ours, "person")
    const sent = client.prepare()
    writeDocument(server, theirs, "remote")
    const receipt = client.receive(sent, {
      epoch: reset ? 2 : 1,
      revision: 2,
      reset,
      stale: !reset,
      update: reset ? seedYDoc(theirs) : Y.encodeStateAsUpdate(server, known),
      stateVector: Y.encodeStateVector(server),
    })
    expect(receipt.failed).toBe(false)
    expect(receipt.rebased).toBe(true)
    const result = client.document()
    if (result?.kind !== "cv") throw new Error("Expected a CV")
    return result
  } finally {
    client.destroy()
    server.destroy()
    empty.destroy()
  }
}

for (const reset of [false, true]) {
  describe(`contact recovery on ${reset ? "reset" : "stale"} replies`, () => {
    it("keeps independently added name and email in both orders", () => {
      const base = blankCv()
      const name = contact(base, { name: "Ada" })
      const email = contact(base, { email: "ada@example.com" })
      for (const [ours, theirs] of [
        [name, email],
        [email, name],
      ]) {
        const result = receive(base, ours!, theirs!, reset)
        expect(result.header).toMatchObject({
          name: "Ada",
          email: "ada@example.com",
        })
      }
    })

    it("keeps removal over untouched contact while recovering paragraph typing", () => {
      const base = contact(blankCv(), { name: "Ada" })
      const typed = structuredClone(base)
      typed.blocks[0] = {
        ...typed.blocks[0]!,
        type: "paragraph",
        content: richTextSchema.parse([{ text: "Later typing" }]),
      }
      const removed = withoutHeader(base)
      for (const [ours, theirs] of [
        [typed, removed],
        [removed, typed],
      ]) {
        const result = receive(base, ours!, theirs!, reset)
        expect(result.header).toBeUndefined()
        expect(paperPlainText(result)).toContain("Later typing")
      }
    })

    it("keeps edited contact over removal in both directions", () => {
      const base = contact(blankCv(), { name: "Ada" })
      const edited = contact(base, { email: "ada@example.com" })
      const removed = withoutHeader(base)
      for (const [ours, theirs] of [
        [edited, removed],
        [removed, edited],
      ]) {
        expect(receive(base, ours!, theirs!, reset).header).toEqual(
          edited.header
        )
      }
    })

    it("keeps the local conflicting field and unchanged body through the editor round trip", () => {
      for (const base of [
        blankCv(),
        contact(blankCv(), { email: "before@example.com" }),
      ]) {
        const result = receive(
          base,
          contact(base, { email: "local@example.com" }),
          contact(base, { email: "remote@example.com" }),
          reset
        )
        expect(result.header?.email).toBe("local@example.com")
        expect(result.blocks).toEqual(base.blocks)
      }
    })
  })
}
