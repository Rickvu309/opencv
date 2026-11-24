import { ERROR_CODES, coachActor } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import type { pendingActions } from "../db/schema.js"
import {
  chatForDelegateProposals,
  hostDelegateProposals,
  hostTaskApprovals,
  lockTaskApproval,
} from "./proposal-hosts.js"

type Proposal = typeof pendingActions.$inferSelect

const proposal = (coachTaskId: string | null) =>
  ({ id: "proposal", userId: "ada", coachTaskId }) as Proposal

describe("Control with no context registered", () => {
  it("treats a proposal that belongs to no task as a plain proposal", async () => {
    expect(await lockTaskApproval(proposal(null))).toBeNull()
  })

  it("refuses to approve a task proposal", () => {
    expect(() => lockTaskApproval(proposal("task"))).toThrow(
      expect.objectContaining({ code: ERROR_CODES.CONFLICT })
    )
  })

  it("leaves a task proposal alone during upkeep", async () => {
    expect(await lockTaskApproval(proposal("task"), true)).toBeNull()
  })

  it("refuses a proposal from a connected agent", () => {
    expect(() => chatForDelegateProposals()).toThrow(
      expect.objectContaining({ code: ERROR_CODES.CONFLICT })
    )
  })
})

describe("Control after Coach and Chat register", () => {
  it("locks a task proposal through what Coach registered", async () => {
    const seen: unknown[] = []
    const approval = {
      actor: coachActor("ada", "00000000-0000-4000-8000-000000000001", "turn"),
      resolve: async () => {},
    }
    hostTaskApprovals(async (row, maintenance) => {
      seen.push([row.coachTaskId, maintenance])
      return approval
    })
    expect(await lockTaskApproval(proposal("task"))).toBe(approval)
    expect(await lockTaskApproval(proposal(null))).toBeNull()
    expect(seen).toEqual([["task", false]])
  })

  it("holds an agent's proposal in the Chat that Chat registered", () => {
    const chat = { open: async () => {}, show: async () => {} }
    hostDelegateProposals(chat)
    expect(chatForDelegateProposals()).toBe(chat)
  })
})
