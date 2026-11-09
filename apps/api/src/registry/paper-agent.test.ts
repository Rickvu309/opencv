import { delegateActorSchema } from "@workspace/domain"
import { afterEach, expect, it, vi } from "vitest"

import { registeredAgentScopes } from "../connections/index.js"
import { CommandError } from "./errors.js"
import {
  paperAgentError,
  paperAgentRefusal,
  paperEditBasisMessage,
  paperToolAnnotations,
  paperToolDescription,
  publicPaperProposal,
} from "./paper-agent.js"
import { delegateAllowed } from "./delegate-policy.js"

afterEach(() => {
  vi.unstubAllEnvs()
})

function agent(scopes: string[], resources: "none" | "jobs") {
  return delegateActorSchema.parse({
    type: "delegate",
    userId: "user-paper-agent",
    connectionId: "11111111-1111-4111-8111-111111111111",
    name: "Paper agent",
    scopes,
    resources,
    reads: "allow",
    writes: "approval",
  })
}

const paperScopes = ["paper.read", "paper.write"]

it("keeps document tools off and leaves job access unchanged", () => {
  const paper = agent(paperScopes, "none")
  const jobs = agent(["job.read", "job.write"], "jobs")
  expect(registeredAgentScopes).toEqual([
    "connection.status",
    "job.read",
    "job.write",
    "offline_access",
  ])
  expect(paperAgentRefusal("paper.read")).toMatch(/not available to agents/)
  expect(paperAgentRefusal("job.get")).toBeNull()
  expect(delegateAllowed({ name: "paper.read", coach: "never" }, paper)).toBe(
    false
  )
  expect(delegateAllowed({ name: "paper.edit", coach: "confirm" }, paper)).toBe(
    false
  )
  expect(
    delegateAllowed(
      { name: "job.get", coach: "auto", delegate: "jobRead" },
      jobs
    )
  ).toBe(true)
  expect(delegateAllowed({ name: "activity.undo", coach: "never" }, jobs)).toBe(
    false
  )
  expect(paperToolDescription("paper.read")).toMatch(/nextCursor/)
  expect(paperToolDescription("paper.edit")).toMatch(
    /Never report Applied or Saved/
  )
  expect(paperToolAnnotations("paper.read")).toEqual({ idempotentHint: true })
  expect(paperToolAnnotations("paper.edit")).toEqual({})
  expect(paperToolDescription("job.get")).toBeNull()
})

it("opens only the two document tools when the switch and scopes agree", () => {
  vi.stubEnv("PAPER_AGENT_TOOLS", "true")
  const jobs = agent(["job.read", "job.write"], "jobs")
  const readOnly = agent(["paper.read"], "none")
  const paper = agent(paperScopes, "none")
  expect(delegateAllowed({ name: "paper.read", coach: "never" }, jobs)).toBe(
    false
  )
  expect(delegateAllowed({ name: "paper.edit", coach: "confirm" }, jobs)).toBe(
    false
  )
  expect(
    delegateAllowed({ name: "paper.read", coach: "never" }, readOnly)
  ).toBe(true)
  expect(
    delegateAllowed({ name: "paper.edit", coach: "confirm" }, readOnly)
  ).toBe(false)
  expect(delegateAllowed({ name: "paper.read", coach: "never" }, paper)).toBe(
    true
  )
  expect(delegateAllowed({ name: "paper.edit", coach: "confirm" }, paper)).toBe(
    true
  )
  expect(delegateAllowed({ name: "paper.sync", coach: "never" }, paper)).toBe(
    false
  )
  expect(
    delegateAllowed({ name: "activity.undo", coach: "never" }, paper)
  ).toBe(false)
  expect(
    delegateAllowed(
      { name: "job.get", coach: "auto", delegate: "jobRead" },
      paper
    )
  ).toBe(false)
})

it("turns known failures into a next step without private text", () => {
  const leaked = new Error("secret cursor value and /tmp/private")
  leaked.name = "ZodError"
  const read = paperAgentError(leaked, "paper.read")
  expect(read.code).toBe("unsupported")
  expect(read.error).not.toMatch(/secret|\/tmp/)
  expect(read.next).toMatch(/Read the document again/)
  const validation = paperAgentError(
    new CommandError("VALIDATION_ERROR", "before is empty: secret"),
    "paper.edit"
  )
  expect(validation.code).toBe("unsupported")
  expect(validation.error).not.toMatch(/secret/)
  expect(paperAgentError(new Error(paperEditBasisMessage)).code).toBe("reread")
  expect(
    paperAgentError(
      new Error("This text is larger than the supported Word region.")
    ).code
  ).toBe("too_large")
  expect(
    paperAgentError(new Error("Saved Word documents are unavailable.")).next
  ).toMatch(/OpenCV/)
  const proposal = publicPaperProposal(
    {
      pending: true,
      pendingActionId: "proposal-1",
      command: "paper.edit",
      review: { restore: { id: "private" } },
      summary: "Applied Saved",
    },
    "https://opencv.example/coach?chat=1"
  )
  expect(proposal).toEqual({
    pending: true,
    proposalId: "proposal-1",
    status: "pending approval",
    url: "https://opencv.example/coach?chat=1",
  })
  expect(JSON.stringify(proposal)).not.toMatch(/Applied|Saved|restore|private/)
  expect(publicPaperProposal({ pending: true }, undefined)).toBeNull()
})
