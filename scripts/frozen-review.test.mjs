import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import test from "node:test"
import { approvalSource, detect, kernelSource } from "./lib/frozen-review.mjs"

const root = new URL("../", import.meta.url)
const source = readFileSync(
  new URL("apps/api/src/registry/frozen-review.ts", root),
  "utf8"
)
const registry = readFileSync(
  new URL("apps/api/src/registry/registry.ts", root),
  "utf8"
)
const require = createRequire(new URL("apps/api/package.json", root))
const z = require("zod").z
const inputHash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex")
const clean = `async function prepareReview() { requirePreparationBoundary(); return binding.parse(await binding.prepare()); }
function readFrozenReview() { envelopeSchema.safeParse(); inputHash(); binding.parse(); if (body.bindingVersion) refuseFrozenReview(); }
async function approve() { await lockProposal(); readFrozenReview(); await consumeFrozenReservation(); }`
const mistake = `async function prepareReview() { return binding.prepare(); }
function readFrozenReview() { return stored; }
async function approve() { return binding.prepare(); }`

function load(text, ambient = false) {
  const exports = {}
  const run = new Function(
    "exports",
    "z",
    "inputHash",
    "insideTransaction",
    "CommandError",
    "ERROR_CODES",
    "createId",
    kernelSource(text)
  )
  run(
    exports,
    z,
    inputHash,
    () => ambient,
    class extends Error {
      constructor(code, message) {
        super(message)
        this.code = code
      }
    },
    { CONFLICT: "CONFLICT" },
    () => "proposal"
  )
  return exports
}
const binding = {
  version: "v1",
  parse: (prepared) => ({
    candidate: z.string().parse(prepared.candidate),
    review: z.string().parse(prepared.review),
  }),
  prepare: async () => ({ candidate: "private", review: "full review" }),
}

test("frozen review pure detector rejects mistake and accepts clean and owning source", () => {
  assert.equal(detect(mistake).length, 3)
  assert.deepEqual(detect(clean), [])
  assert.deepEqual(detect(source), [])
  assert.deepEqual(detect(registry), [])
})

test("actual kernel refuses ambient preparation and its check-removal mutant fails", async () => {
  let calls = 0
  const counted = {
    ...binding,
    prepare: async () => {
      calls++
      return binding.prepare()
    },
  }
  await assert.rejects(
    load(source, true).prepareReview(
      counted,
      {},
      { userId: "owner" },
      "fixture.review",
      "key"
    )
  )
  assert.equal(calls, 0)
  const mutant = source.replace(
    "  requirePreparationBoundary()\n  const hash",
    "  const hash"
  )
  assert.notEqual(mutant, source)
  await load(mutant, true).prepareReview(
    counted,
    {},
    { userId: "owner" },
    "fixture.review",
    "key"
  )
  assert.equal(calls, 1)
  assert.ok(detect(mutant).length > 0)
})

test("actual saved candidate identity rejects tampering and its check-removal mutant fails", async () => {
  const kernel = load(source)
  const stored = await kernel.prepareReview(
    binding,
    {},
    { userId: "owner" },
    "fixture.review",
    "key"
  )
  assert.equal(
    kernel.readFrozenReview(stored, binding, "owner", "fixture.review", {})
      .review,
    "full review"
  )
  const altered = { ...stored, candidate: "altered" }
  assert.throws(() =>
    kernel.readFrozenReview(altered, binding, "owner", "fixture.review", {})
  )
  const mutant = source.replace("digest !== inputHash(body)", "false")
  assert.notEqual(mutant, source)
  assert.equal(
    load(mutant).readFrozenReview(
      altered,
      binding,
      "owner",
      "fixture.review",
      {}
    ).candidate,
    "altered"
  )
})

test("approval cannot replace validation with preparation", () => {
  const mutant = registry.replace(
    /readFrozenReview\(\s*row.frozenReview/,
    "prepareReview(row.frozenReview"
  )
  assert.notEqual(mutant, registry)
  assert.ok(detect(mutant).length > 0)
})

async function approvalReplay(text) {
  const kernel = load(source)
  const frozen = await kernel.prepareReview(
    binding,
    {},
    { userId: "owner" },
    "fixture.review",
    "key"
  )
  let commits = 0,
    consumed = 0
  const row = {
    id: "proposal",
    userId: "owner",
    chatId: "chat",
    command: "fixture.review",
    input: {},
    frozenReview: frozen,
    status: "pending",
    basisRevision: null,
  }
  const values = {
    expireIfStale: async () => {},
    transaction: (effect) => effect(),
    lockProposal: async () => ({ row, task: null }),
    readFrozenReview: kernel.readFrozenReview,
    prepareReview: load(source, true).prepareReview,
    consumeFrozenReservation: async () => {
      consumed++
    },
    refuseFrozenReview: kernel.refuseFrozenReview,
    ERROR_CODES: { CONFLICT: "CONFLICT" },
    CommandError: Error,
    approvedProposalActor: () => ({
      type: "coach",
      userId: "owner",
      chatId: "chat",
    }),
    approvedDelegate: Symbol(),
    frozenExecution: Symbol(),
    approvingReview: Symbol(),
    taskExecution: Symbol(),
    reviewReceiptKey: () => "key",
    getDb: () => ({
      update: () => ({ set: () => ({ where: async () => {} }) }),
    }),
    pendingActions: { id: "id" },
    eq: () => true,
    activityById: async () => ({ id: "receipt" }),
    activityByKey: async () => ({ id: "receipt" }),
  }
  const approve = new Function(...Object.keys(values), approvalSource(text))(
    ...Object.values(values)
  )
  const owner = {
    commands: new Map([["fixture.review", { reviewed: binding }]]),
    publicActivity: (value) => value,
    execute: async () => {
      commits++
      return { activityId: "receipt" }
    },
  }
  const result = await approve.call(owner, "owner", "proposal")
  assert.equal(consumed, 1)
  assert.equal(commits, 1)
  assert.equal(result.id, "receipt")
}

test("actual approval replay succeeds with stored identity and fails if changed to reprepare", async () => {
  await approvalReplay(registry)
  const mutant = registry.replace(
    /readFrozenReview\(\s*row.frozenReview/,
    "await prepareReview(row.frozenReview"
  )
  assert.notEqual(mutant, registry)
  await assert.rejects(approvalReplay(mutant), /preparation must start/)
})
