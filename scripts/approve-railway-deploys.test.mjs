import assert from "node:assert/strict"
import test from "node:test"

import { pickApprovals } from "./approve-railway-deploys.mjs"

const repo = "Rickvu309/opencv"
let clock = 0
const make = (id, serviceId, status, meta = {}) => ({
  id,
  serviceId,
  status,
  createdAt: new Date(Date.UTC(2026, 9, 30, 0, clock++)).toISOString(),
  meta: {
    repo: repo.toLowerCase(),
    branch: "main",
    commitAuthor: "github-merge-queue[bot]",
    ...meta,
  },
})
const ids = (list) => pickApprovals(list, { repo }).map((d) => d.id)

test("approves the newest held release of each service", () => {
  const list = [
    make("old-web", "web", "NEEDS_APPROVAL"),
    make("old-api", "api", "NEEDS_APPROVAL"),
    make("new-web", "web", "NEEDS_APPROVAL"),
    make("api-skip", "api", "SKIPPED"),
  ]
  assert.deepEqual(ids(list).sort(), ["new-web", "old-api"])
})

test("never approves a held release older than a live one", () => {
  const list = [
    make("held-web", "web", "NEEDS_APPROVAL"),
    make("live-web", "web", "SUCCESS"),
    make("held-api", "api", "NEEDS_APPROVAL"),
    make("building-api", "api", "BUILDING"),
  ]
  assert.deepEqual(ids(list), [])
})

test("approves only merge queue releases of main in this repo", () => {
  const list = [
    make("human", "web", "NEEDS_APPROVAL", { commitAuthor: "someone" }),
    make("branch", "api", "NEEDS_APPROVAL", { branch: "feature" }),
    make("fork", "docs", "NEEDS_APPROVAL", { repo: "other/opencv" }),
  ]
  assert.deepEqual(ids(list), [])
})
