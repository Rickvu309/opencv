import assert from "node:assert/strict"
import { it } from "node:test"
import { z } from "zod"

import { catalog } from "./catalog.js"
import {
  declarationsFromEntries,
  grantCopy,
  proposalGrantAllows,
  registeredScopesFromDeclarations,
  resourcesForScopes,
  consentQueryFromSearch,
  scopesFromSearch,
} from "./delegate-grant.js"
import { defineOperation, delegateDeclaration } from "./operation.js"
import { operation as paperRead } from "./operations/paper/read/operation.js"

const paperProposal = ["paper", "write"].join(".")

const jobs = {
  resources: "jobs" as const,
  reads: "allow" as const,
  writes: "approval" as const,
  scopes: ["connection.status", "job.read", "job.write", "offline_access"],
}

it("derives the published agent scopes from job declarations only", () => {
  const scopes = registeredScopesFromDeclarations(
    declarationsFromEntries(Object.values(catalog))
  )
  assert.deepEqual(scopes, [
    "connection.status",
    "job.read",
    "job.write",
    "offline_access",
  ])
  assert.equal(
    scopes.some((scope) => scope.startsWith("paper.")),
    false
  )
  assert.equal(paperRead.delegate, undefined)
})

it("keeps a job grant on jobs and gives a document scope nothing", () => {
  assert.deepEqual(resourcesForScopes(jobs.scopes), { kind: "jobs" })
  assert.deepEqual(
    resourcesForScopes(["connection.status", "paper.read", paperProposal]),
    { kind: "none" }
  )
  assert.deepEqual(resourcesForScopes(["job.read", paperProposal]), {
    kind: "jobs",
  })
})

it("maps today's job markers onto read and proposal access", () => {
  assert.deepEqual(delegateDeclaration("jobRead"), {
    resource: "job",
    access: "read",
  })
  assert.deepEqual(delegateDeclaration("reversibleJob"), {
    resource: "job",
    access: "proposal",
  })
  assert.equal(delegateDeclaration(undefined), null)
})

it("refuses a document proposal on a job grant", () => {
  const paper = delegateDeclaration({ resource: "paper", access: "read" })
  assert.deepEqual(paper, { resource: "paper", access: "read" })
  assert.equal(
    proposalGrantAllows(
      { kind: "jobs" },
      jobs.scopes,
      "approval",
      delegateDeclaration("reversibleJob")!
    ),
    true
  )
  assert.equal(
    proposalGrantAllows(
      { kind: "jobs" },
      ["job.read"],
      "approval",
      delegateDeclaration("reversibleJob")!
    ),
    false
  )
  assert.equal(
    proposalGrantAllows(
      { kind: "jobs" },
      [...jobs.scopes, paperProposal],
      "approval",
      { resource: "paper", access: "proposal" }
    ),
    false
  )
})

it("describes a job grant without treating a document scope as permission to change jobs", () => {
  assert.deepEqual(
    grantCopy({ resources: { kind: "jobs" }, scopes: jobs.scopes }),
    {
      share: "All current and future Jobs · Reversible changes need approval",
      access: "Reads allowed · Writes need approval",
    }
  )
  assert.deepEqual(
    grantCopy({
      resources: { kind: "jobs" },
      scopes: ["connection.status", "job.read", paperProposal],
    }),
    {
      share: "All current and future Jobs · This agent cannot change things",
      access: "Reads allowed · This agent cannot change things",
    }
  )
  assert.equal(
    grantCopy({
      resources: resourcesForScopes(["paper.read"]),
      scopes: ["paper.read"],
    }).share,
    "Connection status only · No documents or Jobs shared"
  )
})

it("reads requested scopes from the consent query", () => {
  const inner = "client_id=agent&scope=connection.status%20job.read"
  assert.deepEqual(
    scopesFromSearch(`oauth_query=${encodeURIComponent(inner)}`),
    ["connection.status", "job.read"]
  )
})

it("refuses a repeated oauth_query instead of keeping the last one", () => {
  const read = "client_id=agent&scope=connection.status%20job.read"
  const write = "client_id=agent&scope=connection.status%20job.read%20job.write"
  const search = `oauth_query=${encodeURIComponent(write)}&oauth_query=${encodeURIComponent(read)}`
  assert.equal(consentQueryFromSearch(search), null)
  assert.deepEqual(scopesFromSearch(search), [])
  assert.deepEqual(
    scopesFromSearch(`oauth_query=${encodeURIComponent(write)}`),
    ["connection.status", "job.read", "job.write"]
  )
})

it("rejects a delegate resource that does not match the operation", () => {
  assert.throws(() =>
    defineOperation({
      owner: "paper",
      name: "paper.read",
      version: 1,
      kind: "read",
      description: "Read a document page.",
      input: z.object({}).strict(),
      publicResult: z.object({}).strict(),
      coach: "auto",
      delegate: "jobRead",
      dependsOn: () => [{ name: "paper", coachFloor: "auto" }],
    })
  )
})
