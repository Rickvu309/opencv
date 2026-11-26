import { randomUUID } from "node:crypto"

import { personActor } from "@workspace/domain/kernel"
import { expect, it } from "vitest"

import { registeredAgentScopes } from "../connections/index.js"
import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import {
  createProposalClient,
  toolReply as reply,
} from "../test/proposal-client.js"
import { paperFromLines } from "./import/word-to-paper.js"
import { createPaper } from "./store.js"

const doorScope = registeredAgentScopes.join(" ")

it("an agent reads its own Paper, lists only its own, and is refused another person's Paper exactly as an unknown one", async () => {
  const door = await createProposalClient(doorScope)
  try {
    const owner = door.owner.user.id
    const other = "user-paper-other-person"
    await door.db.insert(user).values({
      id: other,
      name: "Bea",
      email: "paper-other@example.com",
    })
    const make = (userId: string, texts: string[]) =>
      withDatabase(door.db, () =>
        createPaper(personActor(userId), {
          kind: "cv",
          name: "CV",
          paper: paperFromLines(
            "cv",
            texts.map((text) => ({ style: "Normal" as const, text }))
          ),
        })
      )
    const theirs = await make(other, ["Bea private paragraph"])
    const mine = await make(owner, ["My first line", "My second line"])
    const call = async (name: string, args: Record<string, unknown>) =>
      reply(await door.sdk.callTool({ name, arguments: args }))
    const refusedPrivately = (result: ReturnType<typeof reply>) => {
      expect(result.isError).toBe(true)
      const text = JSON.stringify(result.body)
      for (const secret of [theirs.id, other, "Bea private"])
        expect(text).not.toContain(secret)
      return result.body
    }
    const unknownDoc = randomUUID()
    expect(
      refusedPrivately(await call("paper_read", { docId: theirs.id }))
    ).toEqual(refusedPrivately(await call("paper_read", { docId: unknownDoc })))

    const own = await call("paper_read", { docId: mine.id })
    expect(own.isError).toBeFalsy()
    expect(JSON.stringify(own.body)).toContain("My first line")

    const library = await call("paper_read", { view: "library" })
    expect(library.isError).toBeFalsy()
    const listed = JSON.stringify(library.body)
    expect(listed).toContain(mine.id)
    expect(listed).not.toContain(theirs.id)

    const edit = (docId: string) =>
      call("paper_edit", {
        docId,
        basedOn: 1,
        edits: [
          {
            op: "replaceText",
            blockId: "paragraph-1",
            from: 0,
            to: 0,
            before: "",
            text: "x",
          },
        ],
      })
    expect(refusedPrivately(await edit(theirs.id))).toEqual(
      refusedPrivately(await edit(unknownDoc))
    )

    const read = (
      own.body as {
        data: { revision: number; nativeBasis: unknown; outline: string }
      }
    ).data
    const [first] = (
      JSON.parse(read.outline) as { id: string; content: { text: string }[] }[]
    ).filter((node) =>
      node.content.some((run) => run.text.includes("My first line"))
    )
    const proposed = await call("paper_edit", {
      docId: mine.id,
      basedOn: read.revision,
      nativeBasis: read.nativeBasis,
      edits: [
        {
          op: "replaceText",
          blockId: first!.id,
          from: 0,
          to: 0,
          before: "",
          text: "Updated: ",
        },
      ],
    })
    expect(proposed.isError, JSON.stringify(proposed.body)).toBeFalsy()
    expect(JSON.stringify(proposed.body)).toContain("pending")
  } finally {
    await door.close()
  }
})
