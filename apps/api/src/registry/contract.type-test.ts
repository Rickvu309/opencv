// Typechecked by `tsc --noEmit` only. Every expect-error directive below must keep erroring.
import {
  commandEntry,
  commands,
  type ContractCommandName,
  type InboxContract,
  jobContract,
  parseJobId,
  parsePaperId,
  type CommandInput,
  type JobContract,
} from "@workspace/domain"
import { z } from "zod"

import { bindCommands, type Bindings } from "./bind.js"
import type { Registry } from "./registry.js"

type MoveInput = CommandInput<JobContract, "job.move">
type StarInput = CommandInput<JobContract, "job.star">
type Move = Bindings<JobContract>["job.move"]
type Delete = Bindings<JobContract>["job.delete"]
type Snooze = CommandInput<InboxContract, "inbox.snooze">
type MarkDone = Bindings<InboxContract>["inbox.markDone"]

export function typeProbes(registry: Registry) {
  // prettier-ignore
  // @ts-expect-error unknown command name
  const unknownName = jobContract["job.nope"]

  // prettier-ignore
  // @ts-expect-error the old stage word is not a stage
  const oldStage: MoveInput = { jobId: someJobId, stage: "prep" }

  // prettier-ignore
  // @ts-expect-error a PaperId is not a JobId
  const paperAsJob: StarInput = { jobId: parsePaperId(uuid), starred: true }

  // prettier-ignore
  // @ts-expect-error every command in the contract needs a binding
  bindCommands(registry, jobContract, { "job.star": starBinding })

  // prettier-ignore
  // @ts-expect-error a handler must return the declared output
  const wrongOutput: Delete["handler"] = async () => ({ nope: 1 })

  // prettier-ignore
  // @ts-expect-error a reversal must be a valid input of the command it names
  const wrongReversal: Move["reversal"] = () => ({ command: "job.move", input: { stage: "saved" } })

  // prettier-ignore
  // @ts-expect-error a reversal must name a command of the same contract
  const foreignReversal: Move["reversal"] = () => ({ command: "paper.replace", input: {} })

  // prettier-ignore
  // @ts-expect-error unknown inbox command name
  const unknownInbox = commands["inbox.nope"]

  // prettier-ignore
  // @ts-expect-error snooze needs until, not a duration
  const wrongInboxInput: Snooze = { threadId: uuid, minutes: 5 }

  // prettier-ignore
  // @ts-expect-error the merged table names no command that neither contract declares
  const notAContractName: ContractCommandName = "paper.replace"

  // prettier-ignore
  // @ts-expect-error an inbox reversal must be a valid input of the command it names
  const wrongInboxReversal: MarkDone["reversal"] = () => ({ command: "inbox.markDone", input: { status: "done" } })

  return [
    unknownInbox,
    wrongInboxInput,
    notAContractName,
    wrongInboxReversal,
    unknownName,
    oldStage,
    paperAsJob,
    wrongOutput,
    wrongReversal,
    foreignReversal,
  ]
}

const uuid = "00000000-0000-4000-8000-000000000000"
const someJobId = parseJobId(uuid)
const starBinding = {} as Bindings<JobContract>["job.star"]

// @ts-expect-error destructive cannot use coach auto
export const autoDestructive = commandEntry({
  description: "x",
  input: z.object({}),
  output: z.object({}),
  coach: "auto",
  destructive: true,
  step: () => "x",
  invalidates: () => [],
})

export const unknownInvalidation = commandEntry({
  description: "x",
  input: z.object({}),
  output: z.object({}),
  coach: "never",
  destructive: false,
  step: () => "x",
  // @ts-expect-error invalidates can only name a registered query
  invalidates: () => [{ query: "job.nope" }],
})
