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
const effect = readFileSync(
  new URL("apps/api/src/coach/task-effects.ts", root),
  "utf8"
)
const require = createRequire(new URL("apps/api/package.json", root))
const z = require("zod").z
const inputHash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex")
const clean = `async function prepareReview() { requirePreparationBoundary(); return binding.parse(await binding.prepare()); }
function readFrozenReview() { envelopeSchema.safeParse(); inputHash(); binding.parse(); if (body.bindingVersion) refuseFrozenReview(); }
async function approve() { await lockProposal(); readFrozenReview(); await consumeFrozenReservation(); }
async function prepareTask() { requirePreparationBoundary(); requirePublicationBoundary(); checkPreparationTask(); reviewSnapshot(); this.replayByKey(); executeTaskCommand(); }
async function runIntent() { const prepared = await prepareIntent(); return withOwnedTaskFence(lease, async () => { await storedIntent(); await taskActor(); return prepared.publish(); }); }
async function replayFrozenProposal() { readFrozenReview(); if (pendingActions.createdAt) refuseFrozenReview(); }`
const mistake = `async function prepareReview() { return binding.prepare(); }
function readFrozenReview() { return stored; }
async function approve() { return binding.prepare(); }
async function prepareTask() { return cached; }
async function runIntent() { return withOwnedTaskFence(lease, async () => { const prepared = await prepareIntent(); await storedIntent(); await taskActor(); return prepared.publish(); }); }
async function replayFrozenProposal() { readFrozenReview(); refuseFrozenReview(); }`

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
  assert.equal(detect(mistake).length, 6)
  assert.deepEqual(detect(clean), [])
  assert.deepEqual(detect(source), [])
  assert.deepEqual(detect(registry), [])
  assert.deepEqual(detect(effect), [])
})

async function taskReplay(text) {
  let ambient = false,
    preparations = 0,
    publications = 0,
    events = 0
  const task = { id: "task", ownerId: "owner", chatId: "chat" }
  const intent = {
    step: 0,
    slot: 0,
    intentKey: "coach:task:0:0",
    input: {},
    inputHash: inputHash({}),
    observedRevisions: [],
    operation: "fixture.review",
    operationVersion: 1,
    providerToolUseId: "tool",
    kind: "command",
  }
  const stored = { ...intent, state: "planned" }
  const tables = { coachTasks: {}, coachUsage: {}, toolIntents: {} }
  const values = {
    ...tables,
    getDb: () => ({
      select: () => ({
        from: (table) => ({
          where: async () => [
            table === tables.coachTasks
              ? task
              : table === tables.coachUsage
                ? { id: "usage", userId: "owner", chatId: "chat" }
                : stored,
          ],
        }),
      }),
      update: () => ({
        set: (update) => ({ where: async () => Object.assign(stored, update) }),
      }),
    }),
    and: () => true,
    eq: () => true,
    sql: () => "now",
    inputHash,
    intentKey: () => intent.intentKey,
    coachActor: (userId, chatId, turnId) => ({
      type: "coach",
      userId,
      chatId,
      turnId,
    }),
    append: async () => {
      assert.equal(ambient, true)
      events++
    },
    withOwnedTaskFence: async (_, publish) => {
      assert.equal(ambient, false)
      ambient = true
      try {
        return await publish(task)
      } finally {
        ambient = false
      }
    },
  }
  const exports = {}
  new Function("exports", ...Object.keys(values), kernelSource(text))(
    exports,
    ...Object.values(values)
  )
  const registry = {
    taskCanPrepare: () => true,
    taskNeedsPreparation: () => true,
    prepareTask: async () => {
      assert.equal(ambient, false, "Preparation started inside SQL")
      preparations++
      return async () => {
        assert.equal(ambient, true)
        publications++
        return { pending: true, pendingActionId: "proposal", activityId: null }
      }
    },
    executeTask: () => assert.fail("Reviewed worker bypassed preparation"),
  }
  const lease = { taskId: "task", workerId: "worker", epoch: 1 }
  const first = await exports.runIntent(lease, intent, registry)
  assert.equal(first.pendingActionId, "proposal")
  assert.deepEqual(await exports.runIntent(lease, intent, registry), first)
  assert.equal(preparations, 1)
  assert.equal(publications, 1)
  assert.equal(events, 1)
}

test("actual worker prepares before its owned fence and its outer-transaction mutant fails", async () => {
  await taskReplay(effect)
  const mutant = effect.replace(
    "  const prepared = await prepareIntent(lease, intent, registry)\n  return withOwnedTaskFence(lease, async (task) => {",
    "  return withOwnedTaskFence(lease, async (task) => {\n    const prepared = await prepareIntent(lease, intent, registry)"
  )
  assert.notEqual(mutant, effect)
  assert.ok(detect(mutant).length > 0)
  await assert.rejects(taskReplay(mutant), /Preparation started inside SQL/)
})

test("prepared task publication requires ambient SQL", () => {
  assert.throws(
    () => load(source).requirePublicationBoundary(),
    /owning transaction/
  )
  load(source, true).requirePublicationBoundary()
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
    parseInput: (_schema, input) => input,
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
    confirmed: Symbol(),
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
    reviewedFor: (command) => command.reviewed,
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
