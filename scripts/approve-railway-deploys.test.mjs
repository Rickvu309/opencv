import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

import { pickApprovals, runApprovals } from "./approve-railway-deploys.mjs"

const repo = "Rickvu309/opencv"
let clock = 0
const make = (id, serviceId, status, meta = {}) => ({
  id,
  serviceId,
  status,
  createdAt: new Date(Date.UTC(2026, 9, 30, 0, clock++)).toISOString(),
  meta: {
    repo: repo.toLowerCase(),
    commitHash: "tested-main",
    branch: "main",
    commitAuthor: "github-merge-queue[bot]",
    ...meta,
  },
})
const ids = (list) =>
  pickApprovals(list, { repo, sha: "tested-main" }).map((d) => d.id)

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

test("a newer untested release blocks an older tested release of the same service", () => {
  const list = [
    make("tested", "api", "NEEDS_APPROVAL"),
    make("untested", "api", "NEEDS_APPROVAL", { commitHash: "new-main" }),
  ]
  assert.deepEqual(ids(list), [])
})

test("approves only releases of main in this repo", () => {
  const list = [
    make("branch", "api", "NEEDS_APPROVAL", { branch: "feature" }),
    make("fork", "docs", "NEEDS_APPROVAL", { repo: "other/opencv" }),
  ]
  assert.deepEqual(ids(list), [])
})

test("approves the tested commit of main whoever its author is, since a change now merges under its own author", () => {
  const list = [
    make("owner", "web", "NEEDS_APPROVAL", { commitAuthor: "quanvu309" }),
    make("queue", "api", "NEEDS_APPROVAL"),
  ]
  assert.deepEqual(ids(list).sort(), ["owner", "queue"])
})

test("approval job can check out the private repository without write access", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8"
  )
  const job = workflow
    .split("  approve-railway:\n")[1]
    ?.split(/^  [a-z][a-z-]*:/m)[0]
  assert.ok(job, "release approval job exists")
  assert.match(job, /^    permissions:\n      contents: read$/m)
  assert.doesNotMatch(job, /: write\b|write-all/)
  assert.match(job, /uses: actions\/checkout@v4/)
})

test("a run never approves a different or missing commit", () => {
  assert.deepEqual(
    ids([
      make("other", "api", "NEEDS_APPROVAL", { commitHash: "untested-main" }),
      make("missing", "web", "NEEDS_APPROVAL", { commitHash: undefined }),
    ]),
    []
  )
  assert.deepEqual(
    pickApprovals([make("held", "api", "NEEDS_APPROVAL")], { repo }),
    []
  )
})

const env = {
  RAILWAY_TOKEN: "fake-railway",
  GITHUB_TOKEN: "fake-github",
  GITHUB_REPOSITORY: repo,
  GITHUB_SHA: "tested-main",
}

function network({ heads = ["tested-main"], deployments, githubStatus = 200 }) {
  const mutations = []
  const reads = []
  const fetchImpl = async (url, options) => {
    reads.push(url)
    if (url.startsWith("https://api.github.com/")) {
      assert.equal(options.headers.Authorization, "Bearer fake-github")
      return {
        ok: githubStatus === 200,
        status: githubStatus,
        json: async () => ({
          sha: heads.length > 1 ? heads.shift() : heads[0],
        }),
      }
    }
    const request = JSON.parse(options.body)
    if (request.query.includes("deploymentApprove")) {
      mutations.push(request.variables.id)
      return { ok: true, json: async () => ({ data: {} }) }
    }
    return {
      ok: true,
      json: async () => ({
        data: request.query.includes("projectToken")
          ? {
              projectToken: {
                projectId: "project",
                environmentId: "environment",
              },
            }
          : { deployments: { edges: deployments.map((node) => ({ node })) } },
      }),
    }
  }
  return { mutations, reads, fetchImpl }
}

async function runNetwork(options) {
  const net = network(options)
  const logs = []
  await runApprovals({
    env,
    fetchImpl: net.fetchImpl,
    log: (line) => logs.push(line),
    pause: async () => assert.fail("fixture needs no delay"),
  })
  return { ...net, logs }
}

test("the tested current main is approved only after a fresh main check", async () => {
  const net = await runNetwork({
    deployments: [make("held", "api", "NEEDS_APPROVAL")],
  })
  assert.deepEqual(net.mutations, ["held"])
  assert.equal(
    net.reads.filter((url) => url.startsWith("https://api.github.com/")).length,
    2
  )
})

test("a superseded run never requests a Railway action", async () => {
  const net = await runNetwork({ heads: ["new-main"], deployments: [] })
  assert.deepEqual(net.mutations, [])
  assert.equal(net.reads.length, 1)
  assert.match(net.logs[0], /superseded/)
})

test("main advancing between listing and approval stops the mutation", async () => {
  const net = await runNetwork({
    heads: ["tested-main", "new-main"],
    deployments: [make("held", "api", "NEEDS_APPROVAL")],
  })
  assert.deepEqual(net.mutations, [])
})

test("main lookup failure refuses all approval", async () => {
  const net = network({ githubStatus: 503, deployments: [] })
  await assert.rejects(
    runApprovals({ env, fetchImpl: net.fetchImpl }),
    /Cannot verify current main/
  )
  assert.deepEqual(net.mutations, [])
})

test("a missing main SHA refuses all approval", async () => {
  const net = network({ heads: [undefined], deployments: [] })
  await assert.rejects(
    runApprovals({ env, fetchImpl: net.fetchImpl }),
    /missing SHA/
  )
  assert.deepEqual(net.mutations, [])
  assert.equal(net.reads.length, 1)
})

test("each service gets its own current-main verification", async () => {
  const net = await runNetwork({
    heads: ["tested-main", "tested-main", "new-main"],
    deployments: [
      make("api", "api", "NEEDS_APPROVAL"),
      make("web", "web", "NEEDS_APPROVAL"),
    ],
  })
  assert.deepEqual(net.mutations, ["web"])
})
