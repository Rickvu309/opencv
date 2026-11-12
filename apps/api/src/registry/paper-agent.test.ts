import { delegateActorSchema, paperContract, catalog } from "@workspace/domain"
import { expect, it } from "vitest"

import { registeredAgentScopes } from "../connections/index.js"
import { paperAgentRefusal, paperEditBasisRefused } from "./paper-agent.js"
import { delegateAllowed } from "./delegate-policy.js"

function agent(scopes: string[]) {
  return delegateActorSchema.parse({
    type: "delegate",
    userId: "user-paper-agent",
    connectionId: "11111111-1111-4111-8111-111111111111",
    name: "Paper agent",
    scopes,
    resources: scopes.some((scope) => scope.startsWith("paper."))
      ? "paper"
      : "jobs",
    reads: "allow",
    writes: "approval",
  })
}

it("publishes declared Paper scopes and keeps Job grants isolated", () => {
  expect(registeredAgentScopes).toEqual([
    "connection.status",
    "job.read",
    "job.write",
    "paper.read",
    "paper.write",
    "offline_access",
  ])
  const read = { ...catalog["paper.read"], coach: false }
  const edit = { ...paperContract["paper.edit"], name: "paper.edit" }
  const paper = agent(["paper.read", "paper.write"])
  const jobs = agent(["job.read", "job.write"])
  expect(delegateAllowed(read, paper)).toBe(true)
  expect(delegateAllowed(edit, paper)).toBe(true)
  expect(delegateAllowed(read, jobs)).toBe(false)
  expect(delegateAllowed(edit, jobs)).toBe(false)
  expect(delegateAllowed(edit, agent(["paper.read"]))).toBe(false)
  expect(delegateAllowed({ ...read, name: "fixture.read" }, paper)).toBe(true)
  for (const name of [
    "actions.approve",
    "actions.deny",
    "activity.undo",
    "paper.canvas",
    "paper.sync",
    "paper.restoreWord",
  ]) {
    expect(delegateAllowed({ name, coach: "never" }, paper)).toBe(false)
  }
  expect(paperAgentRefusal("paper.read")).toMatch(/reconnect/)
  expect(paperAgentRefusal("job.get")).toBeNull()
  expect(read.description).toMatch(/nextCursor/)
  expect(read.description).toMatch(/experience or qualifications/)
  expect(edit.description).toMatch(/until the person approves/)
  expect(edit.description).toMatch(/experience or qualifications/)
  expect(paperEditBasisRefused("paper.edit", { basedOn: 1 })).toBe(true)
  expect(
    paperEditBasisRefused("paper.edit", { basedOn: "saved-revision" })
  ).toBe(false)
})
