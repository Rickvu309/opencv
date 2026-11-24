import {
  ERROR_CODES,
  type Actor,
  type PaperId,
  type PaperView,
  type paperContract,
} from "@workspace/domain"

import { CommandError } from "../platform/errors.js"
import type { Registry } from "../registry/registry.js"
import { duplicatePaper, planDuplicate, type DuplicatePlan } from "./store.js"

type LinkedJob = { linked?: Record<string, { id: string } | null> }

function missingJob(error: unknown) {
  return error instanceof CommandError && error.code === ERROR_CODES.NOT_FOUND
}

export async function relinkJobs(
  registry: Registry,
  actor: Actor,
  restored: { page: PaperView; linkedJobs: readonly string[] }
) {
  for (const jobId of restored.linkedJobs) {
    let job: LinkedJob
    try {
      job = (await registry.read("job.get", { jobId }, actor)) as LinkedJob
    } catch (error) {
      if (missingJob(error)) continue
      throw error
    }
    if (job.linked?.[restored.page.kind]) continue
    await registry.execute({
      name: "job.linkPaper",
      input: { jobId, docId: restored.page.id, kind: restored.page.kind },
      actor,
    })
  }
}

function duplicatePlan(value: unknown): DuplicatePlan {
  if (
    value &&
    typeof value === "object" &&
    "kind" in value &&
    (value.kind === "block" ||
      value.kind === "word" ||
      value.kind === "missing")
  )
    return value as DuplicatePlan
  throw new CommandError(
    ERROR_CODES.CONFLICT,
    "This copy is not available. No document was changed."
  )
}

export function registerDuplicate(
  registry: Registry,
  entry: (typeof paperContract)["paper.duplicate"]
) {
  registry.addCommand(
    {
      name: "paper.duplicate",
      description: entry.description,
      input: entry.input,
      coach: entry.coach,
      destructive: entry.destructive,
      idempotency: "keyed",
      prepare: (input, actor) => planDuplicate(actor, input.docId),
      reversal: (_input, output: { id: PaperId; name: string }) => ({
        command: "paper.delete",
        input: { docId: output.id },
      }),
      step: entry.step,
      activity: (_input, output: { id: PaperId; name: string }) => ({
        subjectKind: "paper",
        subjectId: output.id,
        summary: `Duplicated ${output.name}`,
      }),
    },
    (input, actor, ahead) =>
      duplicatePaper(actor, input.docId, duplicatePlan(ahead), input.writer)
  )
}
