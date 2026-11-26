import {
  defineCommand,
  ERROR_CODES,
  effectiveCoachPolicy,
  isCoachActor,
  type Actor,
  type CommandSpec,
  type QuerySpec,
} from "@workspace/domain/kernel"
import { CatalogPublication } from "./catalog-publication.js"
import { coachRefusal, REFUSAL_MESSAGES } from "./coach-policy.js"
import { delegateAllowed } from "./delegate-policy.js"
import { CommandError } from "../platform/errors.js"
import {
  isUnchanged,
  refuseFrozenReview,
  type ReviewedCommand,
} from "./frozen-review.js"
import { brandedActor, parseInput } from "./parse-input.js"
import { agentGates } from "./registry-reads.js"
import type {
  ExecuteOptions,
  ProposalBasis,
  StoredCommand,
  StoredQuery,
  ToolEntry,
} from "./registry-types.js"

export class RegistryEntries extends CatalogPublication {
  protected readonly commands = new Map<string, StoredCommand>()
  protected readonly queries = new Map<string, StoredQuery>()

  protected async admitCommand(options: ExecuteOptions, undo = false) {
    const command = this.commands.get(options.name)
    if (!command)
      throw new CommandError(ERROR_CODES.UNKNOWN_COMMAND, "Unknown command")
    if (command.undoOnly && !undo)
      throw new CommandError(
        ERROR_CODES.FORBIDDEN,
        "This command is only available through Undo"
      )
    const actor = brandedActor(options.actor)
    if (!delegateAllowed(command, actor))
      throw new CommandError(
        ERROR_CODES.FORBIDDEN,
        this.delegateRefusalOf(command.name) ??
          "This connection cannot use this command"
      )
    const parsed = parseInput(command.input, options.input)
    const policy = effectiveCoachPolicy(command, parsed)
    if (actor.type === "delegate" && policy === "never")
      throw new CommandError(
        ERROR_CODES.FORBIDDEN,
        "This resource cannot be changed by an agent"
      )
    if (isCoachActor(actor)) {
      const refusal = coachRefusal(
        { coach: policy, permission: this.coachPermissionOf(command.name) },
        await agentGates(actor.userId)
      )
      if (refusal)
        throw new CommandError(
          ERROR_CODES.COACH_NOT_ALLOWED,
          REFUSAL_MESSAGES[refusal]
        )
    }
    return { command, actor, parsed, policy }
  }

  addCommand<I, O>(
    spec: CommandSpec<I, O> & {
      prepare?: (input: I, actor: Actor) => Promise<unknown>
      basis?: ProposalBasis<I>
    },
    handler: (input: I, actor: Actor, prepared?: unknown) => Promise<O>
  ) {
    const { prepare, basis, ...rest } = spec
    const checked = defineCommand(rest as CommandSpec<I, O>)
    if (this.commands.has(checked.name) || this.queries.has(checked.name)) {
      throw new Error(`Duplicate registry entry ${checked.name}`)
    }
    this.commands.set(checked.name, {
      name: checked.name,
      description: checked.description,
      coach: checked.coach,
      delegate: checked.delegate,
      writes: (raw) => checked.writes?.(parseInput(checked.input, raw)) ?? [],
      destructive: checked.destructive,
      input: checked.input,
      transaction: checked.transaction,
      idempotency: checked.idempotency ?? "keyed",
      ...(prepare
        ? {
            prepare: async (raw: unknown, actor: Actor) =>
              prepare(parseInput(checked.input, raw), actor),
          }
        : {}),
      ...(basis
        ? {
            basis: async (raw: unknown, actor: Actor) =>
              basis(parseInput(checked.input, raw), actor),
          }
        : {}),
      step: (raw) => {
        const parsed = checked.input.safeParse(raw)
        return parsed.success ? checked.step(parsed.data) : checked.name
      },
      run: this.commandRunner(checked, handler),
    })
  }

  private commandRunner<I, O>(
    spec: CommandSpec<I, O>,
    handler: (input: I, actor: Actor, prepared?: unknown) => Promise<O>
  ) {
    return async (raw: unknown, actor: Actor, prepared?: unknown) => {
      const input = parseInput(spec.input, raw)
      const output = await handler(input, actor, prepared)
      return {
        output,
        draft: spec.activity(input, output, actor),
        reversal: spec.reversal(input, output),
        step: spec.step(input),
      }
    }
  }

  addUndoCommand<I, O>(
    spec: CommandSpec<I, O>,
    handler: (input: I, actor: Actor) => Promise<O>
  ) {
    if (
      spec.transaction === "none" ||
      spec.idempotency === "none" ||
      spec.coach !== "never" ||
      spec.delegate
    )
      throw new Error("Undo commands must be private, transactional and keyed")
    this.addCommand(spec, handler)
    this.commands.get(spec.name)!.undoOnly = true
  }

  protected reviewedFor(command: StoredCommand, input: unknown) {
    return !command.select || command.select(input) === "reviewed"
      ? command.reviewed
      : undefined
  }

  addSelectedCommand<I, O, C, V, S = never>(
    spec: CommandSpec<I, O>,
    binding: {
      select: (input: Readonly<I>) => "execute" | "reviewed"
      execute: (input: I, actor: Actor) => Promise<O>
      reviewed: ReviewedCommand<I, O, C, V, S>
    }
  ) {
    this.addReviewedCommand(spec, binding.reviewed)
    const command = this.commands.get(spec.name)!
    command.run = this.commandRunner(spec, binding.execute)
    command.select = (input) => {
      const selected = binding.select(parseInput(spec.input, input))
      if (selected !== "execute" && selected !== "reviewed")
        return refuseFrozenReview()
      return selected
    }
  }

  addReviewedCommand<I, O, C, V, S = never>(
    spec: CommandSpec<I, O>,
    binding: ReviewedCommand<I, O, C, V, S>
  ) {
    if (
      spec.transaction === "none" ||
      spec.idempotency === "none" ||
      !binding.version
    )
      throw new Error(
        "Reviewed commands must be transactional, keyed and versioned"
      )
    this.addCommand(spec, async () => refuseFrozenReview())
    const command = this.commands.get(spec.name)!
    command.reviewed = {
      version: binding.version,
      ...(binding.unchanged
        ? {
            unchanged: {
              parse: (snapshot: unknown) =>
                binding.unchanged!.snapshot.parse(snapshot),
              basis: binding.unchanged!.basis,
              revalidate: (input: unknown, snapshot: unknown, actor: Actor) =>
                binding.unchanged!.revalidate(
                  parseInput(spec.input, input),
                  binding.unchanged!.snapshot.parse(snapshot),
                  actor
                ),
            },
          }
        : {}),
      parse: (prepared) => {
        if (isUnchanged(prepared)) {
          if (!binding.unchanged) return refuseFrozenReview()
          return {
            kind: "unchanged" as const,
            snapshot: binding.unchanged.snapshot.parse(prepared.snapshot),
            output: prepared.output,
          }
        }
        return {
          candidate: binding.candidate.parse(prepared.candidate),
          review: binding.review.parse(prepared.review),
        }
      },
      prepare: (input, actor) =>
        binding.prepare(parseInput(spec.input, input), actor),
      basis: binding.basis,
      revalidate: (input, prepared, actor) =>
        binding.revalidate(
          parseInput(spec.input, input),
          {
            candidate: binding.candidate.parse(prepared.candidate),
            review: binding.review.parse(prepared.review),
          },
          actor
        ),
      run: async (input, prepared, actor, locked) => {
        const parsed = parseInput(spec.input, input)
        const output = await binding.commit(
          parsed,
          {
            candidate: binding.candidate.parse(prepared.candidate),
            review: binding.review.parse(prepared.review),
          },
          actor,
          locked
        )
        return {
          output,
          draft: spec.activity(parsed, output, actor),
          reversal: spec.reversal(parsed, output),
          step: spec.step(parsed),
        }
      },
    }
  }

  addQuery<I, O>(spec: QuerySpec<I, O>) {
    if (this.commands.has(spec.name) || this.queries.has(spec.name)) {
      throw new Error(`Duplicate registry entry ${spec.name}`)
    }
    this.queries.set(spec.name, {
      name: spec.name,
      description: spec.description,
      coach: spec.coach,
      delegate: spec.delegate,
      input: spec.input,
      step: (raw) => {
        const parsed = spec.input.safeParse(raw)
        return parsed.success ? spec.step(parsed.data) : spec.name
      },
      read: async (raw, actor) => spec.read(parseInput(spec.input, raw), actor),
      ...(spec.visitor
        ? {
            visitor: async (raw: unknown) =>
              spec.visitor?.(parseInput(spec.input, raw)),
          }
        : {}),
    })
  }

  async readAsVisitor(name: string, input: unknown) {
    const query = this.queries.get(name)
    if (!query?.visitor)
      throw new CommandError(ERROR_CODES.FORBIDDEN, "Sign in to read this")
    return query.visitor(input)
  }

  list() {
    return {
      commands: [...this.commands.values()]
        .filter((command) => !command.undoOnly)
        .map((command) => ({
          name: command.name,
          coach: command.coach,
          destructive: command.destructive,
        })),
      queries: [...this.queries.values()].map((query) => ({
        name: query.name,
        coach: query.coach,
      })),
    }
  }

  taskRequiresApproval(name: string, input: unknown) {
    const command = this.commands.get(name)
    return command
      ? effectiveCoachPolicy(command, parseInput(command.input, input)) ===
          "confirm"
      : false
  }

  taskCanPrepare(name: string) {
    const command = this.commands.get(name)
    return Boolean(command?.reviewed && !command.undoOnly)
  }

  taskNeedsPreparation(name: string, input?: unknown) {
    const command = this.commands.get(name)
    return Boolean(
      command &&
      !command.undoOnly &&
      this.reviewedFor(
        command,
        command.select ? parseInput(command.input, input) : input
      )
    )
  }

  commandNames() {
    return [...this.commands.values()]
      .filter((command) => !command.undoOnly)
      .map((command) => command.name)
  }

  async tools(actor: Actor): Promise<ToolEntry[]> {
    const branded = brandedActor(actor)
    const gates = isCoachActor(branded)
      ? await agentGates(branded.userId)
      : null
    const entries: ToolEntry[] = []
    for (const command of this.commands.values()) {
      if (command.undoOnly) continue
      if (!delegateAllowed(command, branded)) continue
      if (
        gates &&
        coachRefusal(
          {
            coach: command.coach,
            permission: this.coachPermissionOf(command.name),
          },
          gates
        )
      )
        continue
      entries.push({
        name: command.name,
        description: command.description,
        kind: "command",
        coach: command.coach,
        destructive: command.destructive,
        step: command.step,
        input: command.input,
      })
    }
    for (const query of this.queries.values()) {
      if (!delegateAllowed(query, branded)) continue
      if (
        gates &&
        coachRefusal(
          {
            coach: query.coach,
            permission: this.coachPermissionOf(query.name),
          },
          gates
        )
      )
        continue
      entries.push({
        name: query.name,
        description: query.description,
        kind: "query",
        coach: query.coach,
        destructive: false,
        step: query.step,
        input: query.input,
      })
    }
    return entries
  }
}
