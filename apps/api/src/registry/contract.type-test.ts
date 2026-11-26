import {
  commandEntry,
  commands,
  catalog,
  type ContractCommandName,
  paperContract,
  parseJobId,
  parsePaperId,
  type CommandInput,
  type OperationInput,
  type PaperContract,
} from "@workspace/domain"
import { z } from "zod"

import {
  bindCommands,
  type Bindings,
  type OperationBinding,
  type ReversalGuard,
} from "./bind.js"
import type { Registry } from "./registry.js"

type MoveInput = OperationInput<(typeof catalog)["job.move"]>
type StarInput = z.output<(typeof catalog)["job.star"]["input"]>
type Move = OperationBinding<
  (typeof catalog)["job.move"],
  {
    id: string
    stage: "applied"
    position: string
    fromStage: "saved"
    fromPosition: string
  }
>
type Delete = OperationBinding<
  (typeof catalog)["job.delete"],
  { id: string }
>["execute"]
type Snooze = OperationInput<(typeof catalog)["inbox.snooze"]>
type Edit = CommandInput<PaperContract, "paper.edit">
type PaperUpdate = OperationInput<(typeof catalog)["paper.update"]>
type PaperEditBinding = Bindings<PaperContract>["paper.edit"]
type Undo = OperationInput<(typeof catalog)["activity.undo"]>
type ChatDelete = OperationBinding<
  (typeof catalog)["chat.delete"],
  { id: string }
>["execute"]
type ChatRename = OperationBinding<
  (typeof catalog)["chat.rename"],
  { title: string; previousTitle: string }
>["reversal"]
type SetPhoto = z.output<(typeof catalog)["profile.setPhoto"]["input"]>
type AccountDelete = OperationBinding<
  (typeof catalog)["account.delete"],
  { deleted: true }
>["execute"]
type MarkDone = OperationBinding<
  (typeof catalog)["inbox.markDone"],
  {
    id: string
    previousStatus: "open" | "done" | "snoozed"
    previousSnoozeUntil: string | null
  }
>["reversal"]

export function typeProbes(registry: Registry) {
  // prettier-ignore
  // @ts-expect-error unknown command name
  const unknownName = paperContract["paper.nope"]

  // prettier-ignore
  // @ts-expect-error the old stage word is not a stage
  const oldStage: MoveInput = { jobId: someJobId, stage: "prep" }

  // prettier-ignore
  // @ts-expect-error a PaperId is not a JobId
  const paperAsJob: StarInput = { jobId: parsePaperId(uuid), starred: true }

  // prettier-ignore
  // @ts-expect-error every command in the contract needs a binding
  bindCommands(registry, paperContract, {})

  // prettier-ignore
  // @ts-expect-error a handler must return the declared output
  const wrongOutput: Delete = async () => ({ nope: 1 })

  // prettier-ignore
  // @ts-expect-error a reversal must be a valid input of the command it names
  const wrongReversal: Move["reversal"] = () => ({ command: "job.move", input: { stage: "saved" } })

  // prettier-ignore
  // @ts-expect-error paper.replace is gone, and a reversal must name a command of this contract
  const foreignReversal: Move["reversal"] = () => ({ command: "paper.replace", input: {} })

  // prettier-ignore
  // @ts-expect-error a reversal of job.move must say what the card looks like after the move
  const unguardedMove: Move["reversal"] = () => ({ command: "job.move", input: { jobId: someJobId, stage: "saved" } })

  // prettier-ignore
  // @ts-expect-error an expectation can only match fields the read returns
  const wrongExpectation: ReversalGuard = { query: "paper.read", input: { view: "trash", docId: someDocId }, matches: { colour: "red" }, skipped: "x" }

  // prettier-ignore
  // @ts-expect-error an expectation that matches no field would never refuse
  const emptyExpectation: ReversalGuard = { query: "paper.read", input: { view: "trash", docId: someDocId }, matches: {}, skipped: "x" }

  // prettier-ignore
  // @ts-expect-error unknown inbox command name
  const unknownInbox = commands["inbox.nope"]

  // prettier-ignore
  // @ts-expect-error snooze needs until, not a duration
  const wrongInboxInput: Snooze = { threadId: uuid, minutes: 5 }

  // prettier-ignore
  // @ts-expect-error the merged table names no command that no contract declares
  const notAContractName: ContractCommandName = "paper.nope"

  // prettier-ignore
  // @ts-expect-error an inbox reversal must be a valid input of the command it names
  const wrongInboxReversal: MarkDone = () => ({ command: "inbox.markDone", input: { status: "done" }, expect: { query: "inbox.get", input: {}, matches: {}, skipped: "x" } })

  // prettier-ignore
  // @ts-expect-error unknown paper command name
  const unknownPaper = commands["paper.nope"]

  // prettier-ignore
  // @ts-expect-error an edit needs basedOn, not a revision
  const wrongPaperInput: Edit = { docId: parsePaperId(uuid), revision: 2, edits: [] }

  // prettier-ignore
  // @ts-expect-error a status outside the list is not a status
  const wrongStatus: PaperUpdate = { docId: uuid, patch: { status: "fancy" } }

  // prettier-ignore
  // @ts-expect-error a JobId is not a PaperId
  const jobAsPaper: Edit = { docId: someJobId, basedOn: 1, edits: [] }

  // prettier-ignore
  // @ts-expect-error a paper edit handler must return the declared output
  const wrongPaperOutput: PaperEditBinding["handler"] = async () => ({ id: uuid })

  // prettier-ignore
  // @ts-expect-error undo takes an activity id, not a pending action id
  const wrongUndoInput: Undo = { pendingActionId: uuid }

  // prettier-ignore
  // @ts-expect-error a chat delete handler returns the id, not the chat
  const wrongChatOutput: ChatDelete = async () => ({ stopped: true })

  // prettier-ignore
  // @ts-expect-error a chat rename reversal must be a valid input of the command it names
  const wrongChatReversal: ChatRename = () => ({ command: "chat.rename", input: { title: "x" }, expect: { query: "chat.get", input: {}, matches: {}, skipped: "x" } })

  // prettier-ignore
  // @ts-expect-error a photo is a FileId, not a free string
  const wrongPhoto: SetPhoto = { fileId: "avatar.png" }

  // prettier-ignore
  // @ts-expect-error an account delete handler returns the deleted flag, not the profile
  const wrongDelete: AccountDelete = async () => ({ id: "x" })

  return [
    wrongPhoto,
    wrongDelete,
    wrongUndoInput,
    wrongChatOutput,
    wrongChatReversal,
    unknownPaper,
    wrongPaperInput,
    wrongStatus,
    jobAsPaper,
    wrongPaperOutput,
    unknownInbox,
    wrongInboxInput,
    notAContractName,
    wrongInboxReversal,
    unguardedMove,
    wrongExpectation,
    emptyExpectation,
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
const someDocId = parsePaperId(uuid)

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
