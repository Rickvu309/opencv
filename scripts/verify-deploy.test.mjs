import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  makeIsAncestor,
  report,
  services,
  verifyDeploy,
} from "./verify-deploy.mjs"

const commit = "5201a8823b0fc9df52cc319512177b254b446efd"
const older = "86237ebf0000000000000000000000000000000a"
const code = ["apps/api/src/a.ts", "apps/web/src/b.tsx"]

const deployment = (id, status, hash) => ({
  id,
  status,
  meta: { commitHash: hash },
})

function boundary({
  files = code,
  deployments = {},
  health = {},
  clock,
  descendants = [],
} = {}) {
  const calls = []
  let now = 0
  const io = {
    cli(command, args) {
      const service = args[args.indexOf("--service") + 1]
      calls.push(`${command} ${service}`)
      return (
        deployments[service] ?? [
          deployment(`${service}-new`, "SUCCESS", commit),
          deployment(`${service}-old`, "REMOVED", older),
        ]
      )
    },
    async health(origin) {
      calls.push(origin)
      return health[origin] ?? 200
    },
    changedFiles: () => files,
    isAncestor: (ancestor, descendant) =>
      ancestor === commit && descendants.includes(descendant),
    now: () => now,
    async sleep(ms) {
      now += ms
      clock?.(now)
    },
  }
  return { io, calls }
}

const states = (run) =>
  Object.fromEntries(run.results.map((r) => [r.service, r.outcome]))

test("both services deployed with healthy hosts exits 0", async () => {
  const { io } = boundary()
  const run = await verifyDeploy({ commit }, io)
  assert.deepEqual(states(run), { api: "DEPLOYED", web: "DEPLOYED" })
  assert.equal(run.exitCode, 0)
  assert.match(report(commit, run), /RESULT OK commit 5201a88$/m)
})

test("a docs-only commit expects no deploy and never calls Railway", async () => {
  const { io, calls } = boundary({ files: ["docs/deploy.md", "README.md"] })
  const run = await verifyDeploy({ commit }, io)
  assert.deepEqual(states(run), {
    api: "NOT_EXPECTED",
    web: "NOT_EXPECTED",
  })
  assert.equal(run.exitCode, 0)
  assert.deepEqual(calls, [])
})

test("a web-only change expects web and not api", async () => {
  const { io } = boundary({ files: ["apps/web/src/b.tsx"] })
  const run = await verifyDeploy({ commit }, io)
  assert.deepEqual(states(run), { api: "NOT_EXPECTED", web: "DEPLOYED" })
})

test("a build in progress is DEPLOYING with a rerun command and exit 3", async () => {
  for (const status of ["QUEUED", "BUILDING", "DEPLOYING"]) {
    const { io } = boundary({
      deployments: {
        web: [
          deployment("web-new", status, commit),
          deployment("web-old", "SUCCESS", older),
        ],
      },
    })
    const run = await verifyDeploy({ commit }, io)
    assert.equal(states(run).web, "DEPLOYING")
    assert.equal(run.exitCode, 3)
    assert.match(
      report(commit, run),
      new RegExp(
        `^Rerun: node scripts/verify-deploy.mjs --commit ${commit} --wait 600$`,
        "m"
      )
    )
  }
})

test("a failed or crashed deployment is FAILED with exit 1", async () => {
  for (const status of ["FAILED", "CRASHED"]) {
    const { io } = boundary({
      deployments: {
        api: [
          deployment("api-new", status, commit),
          deployment("api-old", "SUCCESS", older),
        ],
      },
    })
    const run = await verifyDeploy({ commit }, io)
    assert.equal(states(run).api, "FAILED")
    assert.match(run.results[0].detail, /production runs 86237eb/)
    assert.equal(run.exitCode, 1)
  }
})

test("an unhealthy host is FAILED even when the deployment succeeded", async () => {
  const { io } = boundary({ health: { "https://opencv.me": 502 } })
  const run = await verifyDeploy({ commit }, io)
  assert.deepEqual(states(run), { api: "DEPLOYED", web: "FAILED" })
  assert.match(run.results[1].detail, /HTTP 502/)
  assert.equal(run.exitCode, 1)
})

test("no deployment yet for this commit is DEPLOYING, not FAILED", async () => {
  const { io } = boundary({
    deployments: { api: [deployment("api-old", "SUCCESS", older)] },
  })
  const run = await verifyDeploy({ commit }, io)
  assert.equal(states(run).api, "DEPLOYING")
  assert.match(run.results[0].detail, /no deployment for this commit yet/)
  assert.equal(run.exitCode, 3)
})

test("a later commit that contains ours is DEPLOYED", async () => {
  const newer = "a".repeat(40)
  for (const ours of [
    [deployment("web-ours", "SUCCESS", commit)],
    [deployment("web-ours", "SKIPPED", commit)],
    [],
  ]) {
    const { io } = boundary({
      descendants: [newer],
      deployments: {
        web: [deployment("web-newer", "SUCCESS", newer), ...ours],
      },
    })
    const run = await verifyDeploy({ commit }, io)
    assert.equal(states(run).web, "DEPLOYED")
    assert.match(run.results[1].detail, /live in later commit aaaaaaa/)
  }
})

test("a skipped deployment waits for the later commit that contains it", async () => {
  const newer = "a".repeat(40)
  const web = (status) => [
    deployment("web-newer", status, newer),
    deployment("web-ours", "SKIPPED", commit),
    deployment("web-old", "SUCCESS", older),
  ]
  const building = boundary({
    descendants: [newer],
    deployments: { web: web("BUILDING") },
  })
  const pending = await verifyDeploy({ commit }, building.io)
  assert.equal(states(pending).web, "DEPLOYING")
  assert.equal(pending.exitCode, 3)
  const landed = boundary({
    descendants: [newer],
    deployments: { web: web("SUCCESS") },
  })
  assert.equal(
    states(await verifyDeploy({ commit }, landed.io)).web,
    "DEPLOYED"
  )
})

test("a health request that throws fails that service and checks the rest", async () => {
  for (const message of [
    "fetch failed",
    "The operation was aborted due to timeout",
  ]) {
    const { io, calls } = boundary()
    io.health = async (origin) => {
      calls.push(origin)
      if (origin.includes("api.")) throw new TypeError(message)
      return 200
    }
    const run = await verifyDeploy({ commit }, io)
    assert.deepEqual(states(run), { api: "FAILED", web: "DEPLOYED" })
    assert.match(
      run.results[0].detail,
      new RegExp(`/health failed: ${message}`)
    )
    assert.equal(run.exitCode, 1)
  }
})

test("a newer unrelated commit live over ours is FAILED", async () => {
  const other = "b".repeat(40)
  const { io } = boundary({
    deployments: {
      web: [
        deployment("web-other", "SUCCESS", other),
        deployment("web-ours", "SUCCESS", commit),
      ],
    },
  })
  const run = await verifyDeploy({ commit }, io)
  assert.equal(states(run).web, "FAILED")
  assert.match(run.results[1].detail, /production runs bbbbbbb/)
})

test("FAILED wins over DEPLOYING", async () => {
  const { io } = boundary({
    deployments: {
      api: [deployment("api-new", "FAILED", commit)],
      web: [deployment("web-new", "BUILDING", commit)],
    },
  })
  assert.equal((await verifyDeploy({ commit }, io)).exitCode, 1)
})

test("--wait rechecks until the deploy lands", async () => {
  let ready = false
  const { io, calls } = boundary({ clock: () => (ready = true) })
  const original = io.cli
  io.cli = (command, args) =>
    ready ? original(command, args) : [deployment("x-new", "BUILDING", commit)]
  const run = await verifyDeploy({ commit, wait: 60 }, io)
  assert.equal(run.exitCode, 0)
  assert.equal(calls.filter((c) => c.startsWith("railway")).length, 2)
})

test("--wait gives up as DEPLOYING when time runs out", async () => {
  const { io } = boundary({
    deployments: {
      api: [deployment("api-new", "BUILDING", commit)],
    },
  })
  const run = await verifyDeploy({ commit, wait: 40 }, io)
  assert.equal(run.exitCode, 3)
})

test("rejects a short or missing commit", async () => {
  const { io } = boundary()
  await assert.rejects(verifyDeploy({ commit: "5201a88" }, io), /full 40/)
  await assert.rejects(verifyDeploy({}, io), /full 40/)
})

test("service watch patterns match .railway/railway.ts", () => {
  const source = readFileSync(
    new URL("../.railway/railway.ts", import.meta.url),
    "utf8"
  )
  for (const service of services) {
    const block = source.slice(source.indexOf(`service("${service.name}"`))
    const list = block.match(/watchPatterns:\s*\[([^\]]*)\]/)[1]
    const patterns = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1])
    assert.deepEqual(service.watchPatterns, patterns, service.name)
  }
  assert.deepEqual(
    services.map((s) => s.name),
    [...source.matchAll(/service\("(\w+)"/g)].map((m) => m[1])
  )
})

test("no covering deployment in a full history window is FAILED, not DEPLOYING", async () => {
  const unrelated = Array.from({ length: 20 }, (_, i) =>
    deployment(`web-${i}`, "SUCCESS", `${i}`.padStart(40, "c"))
  )
  const { io } = boundary({ deployments: { web: unrelated } })
  const run = await verifyDeploy({ commit }, io)
  assert.equal(states(run).web, "FAILED")
  assert.match(run.results[1].detail, /latest 20/)
})

function gitFake({
  present = true,
  fetchOk = true,
  appears = true,
  mergeBase = 0,
}) {
  const calls = []
  let have = present
  const run = (args) => {
    calls.push(args[0])
    if (args[0] === "cat-file" && !have)
      throw Object.assign(new Error("x"), { status: 1 })
    if (args[0] === "fetch") {
      if (!fetchOk) throw Object.assign(new Error("x"), { status: 128 })
      have = appears
    }
    if (args[0] === "merge-base" && mergeBase !== 0)
      throw Object.assign(new Error("x"), { status: mergeBase })
    return ""
  }
  return { isAncestor: makeIsAncestor(run), calls }
}

test("ancestry answers from git, fetching a commit this clone lacks", () => {
  assert.equal(gitFake({}).isAncestor(commit, older), true)
  assert.equal(gitFake({ mergeBase: 1 }).isAncestor(commit, older), false)
  const missing = gitFake({ present: false })
  assert.equal(missing.isAncestor(commit, older), true)
  assert.deepEqual(missing.calls, [
    "cat-file",
    "fetch",
    "cat-file",
    "merge-base",
  ])
})

test("ancestry that git cannot answer throws instead of reading as unrelated", () => {
  assert.throws(
    () => gitFake({ present: false, fetchOk: false }).isAncestor(commit, older),
    /fetch failed/
  )
  assert.throws(
    () => gitFake({ present: false, appears: false }).isAncestor(commit, older),
    /origin does not have/
  )
  assert.throws(
    () => gitFake({ mergeBase: 128 }).isAncestor(commit, older),
    /merge-base failed/
  )
})
