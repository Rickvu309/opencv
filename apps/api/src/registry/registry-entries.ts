import {
  defineCommand,
  effectiveCoachPolicy,
  isCoachActor,
  type Actor,
  type CommandSpec,
  type QuerySpec,
} from "@workspace/domain"
import { CatalogPublication } from "./catalog-publication.js"
import { coachRefusal } from "./coach-policy.js"
import { delegateAllowed } from "./delegate-policy.js"
import { refuseFrozenReview, type ReviewedCommand } from "./frozen-review.js"
import { brandedActor, parseInput } from "./parse-input.js"
import { agentGates } from "./registry-reads.js"
import type { StoredCommand, StoredQuery, ToolEntry } from "./registry-types.js"

export class RegistryEntries extends CatalogPublication {
  protected readonly commands = new Map<string, StoredCommand>()
  protected readonly queries = new Map<string, StoredQuery>()

  addCommand<I, O>(
    spec: CommandSpec<I, O>,
    handler: (input: I, actor: Actor) => Promise<O>
  ) {
    const checked = defineCommand(spec)
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
      step: (raw) => {
        const parsed = checked.input.safeParse(raw)
        return parsed.success ? checked.step(parsed.data) : checked.name
      },
      run: async (raw, actor) => {
        const input = parseInput(checked.input, raw)
        const output = await handler(input, actor)
        return {
          output,
          draft: checked.activity(input, output, actor),
          reversal: checked.reversal(input, output),
          step: checked.step(input),
        }
      },
    })
  }

  addReviewedCommand<I, O, C, V>(
    spec: CommandSpec<I, O>,
    binding: ReviewedCommand<I, O, C, V>
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
      parse: (prepared) => ({
        candidate: binding.candidate.parse(prepared.candidate),
        review: binding.review.parse(prepared.review),
      }),
      prepare: (input, actor) =>
        binding.prepare(parseInput(spec.input, input), actor),
      revalidate: (input, prepared, actor) =>
        binding.revalidate(
          parseInput(spec.input, input),
          {
            candidate: binding.candidate.parse(prepared.candidate),
            review: binding.review.parse(prepared.review),
          },
          actor
        ),
      run: async (input, prepared, actor) => {
        const parsed = parseInput(spec.input, input)
        const output = await binding.commit(
          parsed,
          {
            candidate: binding.candidate.parse(prepared.candidate),
            review: binding.review.parse(prepared.review),
          },
          actor
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
    })
  }

  list() {
    return {
      commands: [...this.commands.values()].map((command) => ({
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

  commandNames() {
    return [...this.commands.keys()]
  }

  async tools(actor: Actor): Promise<ToolEntry[]> {
    const branded = brandedActor(actor)
    const gates = isCoachActor(branded)
      ? await agentGates(branded.userId)
      : null
    const entries: ToolEntry[] = []
    for (const command of this.commands.values()) {
      if (!delegateAllowed(command, branded)) continue
      if (gates && coachRefusal(command, gates)) continue
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
      if (gates && coachRefusal(query, gates)) continue
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
