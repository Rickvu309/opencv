import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect, methodSource } from "./lib/selected-review.mjs"

const root = new URL("../", import.meta.url)
const read = (file) => readFileSync(new URL(file, root), "utf8")
const entries = read("apps/api/src/registry/registry-entries.ts")
const registry = read("apps/api/src/registry/registry.ts")
const effects = read("apps/api/src/coach/task-effects.ts")
const support = read("apps/api/src/test/frozen-review-support.ts")
const frozen = read("apps/api/src/registry/frozen-review.ts")
const kinds = (problems) =>
  [...new Set(problems.map((problem) => problem.kind))].sort()
const clean = `
class Registry {
  taskNeedsPreparation(name: string, input?: unknown) {
    return this.reviewedFor(command, command.select ? input : input)
  }
  async prepareIntent() {
    return registry.taskNeedsPreparation(stored.operation, stored.input)
  }
  async approve() {
    const reviewed = this.reviewedFor(stored, row.input)
    const frozen = reviewed ? readFrozenReview(row.frozenReview) : null
    if ((row.frozenReview != null && !frozen) || (frozen && frozen.proposalId !== row.id))
      return refuseFrozenReview()
  }
  async #execute() {
    if (options[frozenExecution] && !reviewed) return refuseFrozenReview()
  }
  async admitCommand() {
    if (command.undoOnly && !undo) throw new CommandError(ERROR_CODES.FORBIDDEN, "private")
  }
  list() { return filter(command.undoOnly) }
  commandNames() { return filter(command.undoOnly) }
  tools() { return filter(command.undoOnly) }
  async undo() { return this.#execute(options, true) }
  execute() { return this.#execute(options) }
}
`
const mistake = `
class Registry {
  taskNeedsPreparation(name: string) { return Boolean(this.commands.get(name)?.reviewed) }
  async prepareIntent() { return registry.taskCanPrepare(intent.operation) }
  async approve() { return prepareReview() }
  async #execute() {
    if (isUnchanged(frozen)) await reviewed.unchanged.revalidate()
    return command.run()
  }
  async admitCommand() { return command.run() }
  list() { return this.commands }
  commandNames() { return this.commands.keys() }
  tools() { return this.commands }
  async undo() { return this.#execute(options) }
  execute() { return this.#execute(options, true) }
}
`

function load(source, name, names, values) {
  return new Function(...names, methodSource(source, name))(...values)
}

test("selected review detector rejects the four mistakes and accepts clean and owning source", () => {
  assert.deepEqual(kinds(detect(mistake)), [
    "approval-time-prepare",
    "direct-private-restore",
    "name-only-selection",
    "selected-branch-downgrade",
    "unlocked-basis",
  ])
  assert.deepEqual(detect(clean), [])
  assert.deepEqual(detect(entries, "registry-entries.ts"), [])
  assert.deepEqual(detect(registry, "registry.ts"), [])
  assert.deepEqual(detect(effects, "task-effects.ts"), [])
  assert.deepEqual(detect(support, "frozen-review-support.ts"), [])
  assert.deepEqual(detect(frozen, "frozen-review.ts"), [])
})

test("actual source mutants expose name-only selection, approval preparation, downgrade and direct restore", () => {
  const nameOnly = entries.replace(
    `return Boolean(
      command &&
      !command.undoOnly &&
      this.reviewedFor(
        command,
        command.select ? parseInput(command.input, input) : input
      )
    )`,
    "return Boolean(command?.reviewed)"
  )
  const prepared = effects.replace(
    `if (!registry.taskNeedsPreparation(stored.operation, stored.input))
    return null`,
    "return null"
  )
  const reprepare = registry.replace(
    "const stored = this.commands.get(row.command)",
    "await prepareReview()\n      const stored = this.commands.get(row.command)"
  )
  const downgrade = registry.replace(
    `if (
        (row.frozenReview != null && !frozen) ||
        (frozen && frozen.proposalId !== row.id)
      )
        return refuseFrozenReview()`,
    ""
  )
  const opened = entries.replace(
    `if (command.undoOnly && !undo)
      throw new CommandError(
        ERROR_CODES.FORBIDDEN,
        "This command is only available through Undo"
      )`,
    ""
  )
  assert.ok(kinds(detect(nameOnly)).includes("name-only-selection"))
  assert.ok(kinds(detect(prepared)).includes("name-only-selection"))
  assert.ok(kinds(detect(reprepare)).includes("approval-time-prepare"))
  assert.ok(kinds(detect(downgrade)).includes("selected-branch-downgrade"))
  assert.ok(kinds(detect(opened)).includes("direct-private-restore"))
  const unlocked = registry.replace(
    "await publishUnchanged",
    "await skippedUnchanged"
  )
  const plainLock = frozen.replace('.for("update")', '.for("keyShare")')
  const counted = frozen.replace(
    "let accepted: IssuedBasisToken | null = null",
    "let accepted: IssuedBasisToken | null = null\n  void pg_locks"
  )
  const loose = frozen.replace('!("candidate" in value)', "true")
  const plainRestore = support.replace(
    "eq(user.name, expected)",
    "eq(user.id, userId)"
  )
  const plainMutation = support.replace(
    "prepared.candidate.before",
    "actor.userId"
  )
  assert.ok(kinds(detect(unlocked)).includes("unlocked-basis"))
  assert.ok(kinds(detect(plainLock)).includes("unlocked-basis"))
  assert.ok(kinds(detect(counted)).includes("unlocked-basis"))
  assert.ok(kinds(detect(loose)).includes("unchanged-shape"))
  assert.ok(kinds(detect(plainRestore)).includes("unconditional-restore"))
  assert.ok(kinds(detect(plainMutation)).includes("plain-mutation"))
  assert.notEqual(unlocked, registry)
  assert.notEqual(plainLock, frozen)
  assert.notEqual(counted, frozen)
  assert.notEqual(loose, frozen)
  assert.notEqual(plainRestore, support)
  assert.notEqual(plainMutation, support)
  assert.notEqual(nameOnly, entries)
  assert.notEqual(prepared, effects)
  assert.notEqual(reprepare, registry)
  assert.notEqual(downgrade, registry)
  assert.notEqual(opened, entries)
})

test("the owning selector prepares only the reviewed branch", async () => {
  const owner = {
    commands: new Map([
      [
        "fixture.review",
        {
          reviewed: { version: "v1" },
          undoOnly: false,
          input: {},
          select: (input) => (input.legacy ? "execute" : "reviewed"),
        },
      ],
    ]),
    reviewedFor(command, input) {
      return !command.select || command.select(input) === "reviewed"
        ? command.reviewed
        : undefined
    },
  }
  const run = (source) =>
    load(
      source,
      "taskNeedsPreparation",
      ["parseInput"],
      [(_schema, input) => input]
    ).call(owner, "fixture.review", { legacy: true })
  assert.equal(await run(entries), false)
  const mutant = entries.replace(
    `return Boolean(
      command &&
      !command.undoOnly &&
      this.reviewedFor(
        command,
        command.select ? parseInput(command.input, input) : input
      )
    )`,
    "return Boolean(command?.reviewed)"
  )
  assert.equal(await run(mutant), true)
})

test("direct private restore admission stays inside Undo", async () => {
  const command = { name: "fixture.restorePrivate", undoOnly: true, input: {} }
  const owner = { commands: new Map([[command.name, command]]) }
  const names = [
    "CommandError",
    "ERROR_CODES",
    "brandedActor",
    "delegateAllowed",
    "parseInput",
    "effectiveCoachPolicy",
    "isCoachActor",
    "coachRefusal",
    "agentGates",
  ]
  const values = [
    class CommandError extends Error {
      constructor(code, message) {
        super(message)
        this.code = code
      }
    },
    { FORBIDDEN: "FORBIDDEN", UNKNOWN_COMMAND: "UNKNOWN_COMMAND" },
    (actor) => actor,
    () => true,
    (_schema, input) => input,
    () => "auto",
    () => false,
    () => null,
    async () => ({}),
  ]
  const actor = { type: "person", userId: "owner" }
  const call = (source) =>
    load(source, "admitCommand", names, values).call(
      owner,
      { name: command.name, input: {}, actor },
      false
    )
  await assert.rejects(call(entries), (error) => error.code === "FORBIDDEN")
  const mutant = entries.replace(
    `if (command.undoOnly && !undo)
      throw new CommandError(
        ERROR_CODES.FORBIDDEN,
        "This command is only available through Undo"
      )`,
    ""
  )
  assert.equal((await call(mutant)).command, command)
})

function approvalValues(commits) {
  const row = {
    id: "proposal",
    userId: "owner",
    chatId: "chat",
    command: "fixture.review",
    input: { before: "Ada", after: "Grace" },
    frozenReview: { proposalId: "proposal" },
    status: "pending",
    basisRevision: null,
    delegateConnectionId: null,
  }
  return {
    parseInput: (_schema, input) => input,
    expireIfStale: async () => {},
    transaction: (effect) => effect(),
    lockProposal: async () => ({ row, task: null }),
    readFrozenReview: () => row.frozenReview,
    prepareReview: async () => {
      throw new Error("preparation must start")
    },
    consumeFrozenReservation: async () => {},
    refuseFrozenReview: () => {
      throw Object.assign(new Error("downgrade"), { code: "CONFLICT" })
    },
    ERROR_CODES: { CONFLICT: "CONFLICT" },
    CommandError: class extends Error {},
    approvedProposalActor: () => ({ type: "person", userId: "owner" }),
    approvedDelegate: Symbol("approved"),
    frozenExecution: Symbol("frozen"),
    approvingReview: Symbol("approving"),
    taskExecution: Symbol("task"),
    reviewReceiptKey: () => "key",
    getDb: () => ({
      update: () => ({ set: () => ({ where: async () => {} }) }),
    }),
    pendingActions: { id: "id" },
    eq: () => true,
    activityById: async () => ({ id: "receipt" }),
    activityByKey: async () => ({ id: "receipt" }),
    coachActor: () => ({ type: "coach" }),
    commits,
  }
}

test("approval keeps the frozen branch and a downgrade or reprepare mutant does not", async () => {
  const commits = { count: 0 }
  const values = approvalValues(commits)
  const owner = {
    commands: new Map([
      ["fixture.review", { reviewed: { version: "v1" }, input: {} }],
    ]),
    reviewedFor: () => undefined,
    publicActivity: (value) => value,
    execute: async () => {
      commits.count += 1
      return { activityId: "receipt" }
    },
  }
  const approve = (source) => {
    commits.count = 0
    const bound = load(
      source,
      "approve",
      Object.keys(values).filter((name) => name !== "commits"),
      Object.keys(values)
        .filter((name) => name !== "commits")
        .map((name) => values[name])
    )
    return bound.call(owner, "owner", "proposal")
  }
  await assert.rejects(approve(registry), (error) => error.code === "CONFLICT")
  assert.equal(commits.count, 0)
  const downgrade = registry.replace(
    `if (
        (row.frozenReview != null && !frozen) ||
        (frozen && frozen.proposalId !== row.id)
      )
        return refuseFrozenReview()`,
    ""
  )
  await approve(downgrade)
  assert.equal(commits.count, 1)
  const reprepare = registry.replace(
    "const stored = this.commands.get(row.command)",
    "await prepareReview()\n      const stored = this.commands.get(row.command)"
  )
  await assert.rejects(approve(reprepare), /preparation must start/)
  assert.equal(commits.count, 0)
})
