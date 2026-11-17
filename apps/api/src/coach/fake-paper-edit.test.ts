import {
  paperContract,
  wordReviewSchema,
  type CoachStreamPart,
} from "@workspace/domain"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { resolveTurnGrounding } from "./context.js"
import { createDemoCoachRuntime } from "./fake.js"
import { idOf } from "../registry/coverage-helpers.test-support.js"
import { openWordPage, applyWordOps } from "../paper/index.js"
import { seedCoachActor } from "../test/coach-turn.js"

const userId = "user-coach-fake-edit"
let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore(userId)
})

afterEach(() => vi.unstubAllEnvs())

afterAll(async () => {
  await h.store.client.close()
})

describe("the fake Coach", () => {
  it("edits the open paper through paper.edit and returns a receipt", async () => {
    await h.inDatabase(async () => {
      const { docId } = await h.created()
      const grounding = await resolveTurnGrounding({
        registry: h.store.registry,
        actor: h.store.actor,
        requestFocusDocId: docId,
        storedKind: null,
        storedId: null,
        memoryEnabled: false,
      })
      const chat = await h.store.registry.execute({
        name: "chat.create",
        input: {},
        actor: h.store.actor,
      })
      const chatId = idOf(chat.output)
      const actor = await seedCoachActor(userId, chatId)
      const parts: CoachStreamPart[] = []
      for await (const part of createDemoCoachRuntime().streamTurn({
        userId,
        chatId,
        history: [],
        focusDoc: grounding.focusDoc,
        execute: (call) =>
          h.store.registry.execute({
            name: call.name,
            input: call.input,
            actor,
          }),
      })) {
        parts.push(part)
      }
      const result = parts.find((part) => part.type === "tool-result")
      if (!result || result.type !== "tool-result" || !result.pendingActionId)
        throw new Error("missing proposal")
      expect(result).toMatchObject({
        name: "paper.edit",
        ok: true,
        reversal: { possible: false },
      })
      expect(result).not.toHaveProperty("detail")
      const held = await h.paperOf(docId)
      expect(JSON.stringify(held.blocks)).not.toContain(
        "Reviewed by the Coach."
      )
      expect(held.blocks).toHaveLength(3)
      await h.store.registry.approve(userId, result.pendingActionId)
      const blocks = (await h.paperOf(docId)).blocks
      expect(blocks.map((block) => block.id)[0]).toBe("s1")
      expect(JSON.stringify(blocks)).toContain("Reviewed by the Coach.")
      expect(blocks).toHaveLength(4)
    })
  })
})

it.each(["blank", "with words"] as const)(
  "proposes a schema-valid Word change on a page %s",
  async (state) => {
    vi.stubEnv("PAPER_PACKAGE_ENABLED", "true")
    await h.inDatabase(async () => {
      const minted = await openWordPage(userId, {
        kind: "mint",
        name: "Practice CV",
        label: "cv",
      })
      if ("refused" in minted) throw new Error("Word page refused")
      let page = minted
      if (state === "with words") {
        const typed = await applyWordOps(userId, {
          doc: page.doc,
          basedOn: page.revision,
          ops: [
            {
              op: "setText",
              handle: page.paragraphs[0]!.handle,
              text: "Built tools for students.",
            },
          ],
        })
        if (typed.refused) throw new Error("Typing refused")
        page = typed.page
      }
      const grounding = await resolveTurnGrounding({
        registry: h.store.registry,
        actor: h.store.actor,
        requestFocusDocId: page.doc,
        storedKind: null,
        storedId: null,
        memoryEnabled: false,
      })
      const chatId = idOf(
        (
          await h.store.registry.execute({
            name: "chat.create",
            input: {},
            actor: h.store.actor,
          })
        ).output
      )
      const actor = await seedCoachActor(userId, chatId)
      const parts: CoachStreamPart[] = []
      for await (const part of createDemoCoachRuntime().streamTurn({
        userId,
        chatId,
        history: [],
        focusDoc: grounding.focusDoc,
        execute: (call) =>
          h.store.registry.execute({
            name: call.name,
            input: call.input,
            actor,
          }),
      }))
        parts.push(part)
      const call = parts.find((part) => part.type === "tool-call")
      if (!call || call.type !== "tool-call") throw new Error("Missing call")
      expect(
        paperContract["paper.edit"].input.safeParse(call.input).success
      ).toBe(true)
      const result = parts.find((part) => part.type === "tool-result")
      if (!result || result.type !== "tool-result" || !result.pendingActionId)
        throw new Error("Missing approval")
      const review = wordReviewSchema.parse(result.review)
      expect(review.operations).toMatchObject([
        {
          op: "setText",
          before: state === "blank" ? "" : "Built tools for students.",
          after:
            state === "blank"
              ? "Reviewed by the Coach."
              : "Built tools for students. Reviewed by the Coach.",
        },
      ])
      await h.store.registry.approve(userId, result.pendingActionId)
      const saved = await openWordPage(userId, { kind: "read", doc: page.doc })
      if ("refused" in saved) throw new Error(saved.message)
      expect(saved.paragraphs[0]?.text).toBe(
        state === "blank"
          ? "Reviewed by the Coach."
          : "Built tools for students. Reviewed by the Coach."
      )
    })
  }
)
