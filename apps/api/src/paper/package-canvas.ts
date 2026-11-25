import { randomUUID } from "node:crypto"
import { createRequire } from "node:module"

import {
  PAPER_CANVAS_PROFILE,
  catalog,
  paperContract,
  paperPackageEditResultSchema,
  type PaperCanvasCommit,
  type WordPageLabel,
} from "@workspace/domain"
import { and, eq } from "drizzle-orm"

import { getDb, insideTransaction } from "../db/context.js"
import { paperPackageHeads } from "../db/schema.js"
import type { Registry } from "../registry/registry.js"
import { commitWordCandidate } from "./package-candidates.js"
import { packageFailure } from "./package-pages.js"
import {
  publishWordPackage,
  readWordPackage,
  stageWordPackage,
  wordPackageBasis,
} from "./package-store.js"
import { prepareBatch, WORD_UNDO_MOVED } from "./word/document.js"
import {
  templatePageBytes,
  templatePageName,
  writtenPageBytes,
} from "./word/template.js"

const loaded = createRequire(import.meta.url)(
  "../../../../scripts/lib/paper-canvas-bytes.mjs"
) as {
  mintBlankBytes: () => Uint8Array
}

const BLANK_PAGE_NAMES: Record<WordPageLabel, string> = {
  cv: "CV",
  letter: "Cover letter",
}

type CanvasResult = ReturnType<typeof paperPackageEditResultSchema.parse>

type CanvasMint = Extract<PaperCanvasCommit, { op: "mint" }>

function mintedName(input: CanvasMint) {
  if (input.name) return input.name
  if (input.templateId) return templatePageName(input.templateId)
  return BLANK_PAGE_NAMES[input.label]
}

function mintedBytes(input: CanvasMint) {
  if (input.templateId) return templatePageBytes(input.templateId)
  if (input.lines) return writtenPageBytes(input.lines)
  return loaded.mintBlankBytes()
}

async function incarnationOf(owner: string, docId: string) {
  const [head] = await getDb()
    .select({ incarnation: paperPackageHeads.incarnation })
    .from(paperPackageHeads)
    .where(
      and(
        eq(paperPackageHeads.userId, owner),
        eq(paperPackageHeads.docId, docId)
      )
    )
    .limit(1)
  if (!head)
    return packageFailure(
      "This saved Word edit is no longer available. No document was changed."
    )
  return head.incarnation
}

export async function resultOf(
  owner: string,
  docId: string,
  revision: string,
  restore: { id: string; digest: string } | null
): Promise<CanvasResult> {
  const page = await readWordPackage(owner, { docId, at: revision })
  return paperPackageEditResultSchema.parse({
    generation: "package",
    docId,
    revision,
    name: page.name,
    kind: page.kind,
    packageHash: page.packageHash,
    byteSize: page.byteSize,
    incarnation: await incarnationOf(owner, docId),
    restore,
  })
}

type CanvasWrite = Extract<PaperCanvasCommit, { op: "write" }>

export async function prepareCanvas(owner: string, input: CanvasWrite) {
  if (insideTransaction())
    return packageFailure("Prepare the Word edit before starting a save.")
  await wordPackageBasis(owner, input.batch.doc, input.batch.basedOn)
  const drafted = await prepareBatch(owner, input.batch, input)
  if (!drafted.refused) return drafted.prepared
  if (drafted.reason === "stale")
    return packageFailure(
      "This Word document has changed. Read it again before editing."
    )
  return packageFailure(drafted.message)
}

type CanvasAhead =
  | { op: "mint"; stageId: string }
  | {
      op: "edit"
      prepared: Awaited<ReturnType<typeof prepareCanvas>>
    }

function canvasAhead(value: unknown): CanvasAhead {
  if (
    !value ||
    typeof value !== "object" ||
    !("op" in value) ||
    (value.op !== "mint" && value.op !== "edit")
  )
    return packageFailure(
      "This page change is not available. No document was changed."
    )
  return value as CanvasAhead
}

export function registerCanvasCommit(
  registry: Registry,
  entry: (typeof paperContract)["paper.canvas"]
) {
  registry.addCommand(
    {
      name: "paper.canvas",
      description: entry.description,
      input: entry.input,
      coach: entry.coach,
      destructive: entry.destructive,
      idempotency: "keyed",
      transaction: "none",
      prepare: async (input, actor) => {
        if (input.op === "mint") {
          if (input.jobId)
            await registry.read("job.get", { jobId: input.jobId }, actor)
          const stage = await stageWordPackage(
            actor.userId,
            {
              requestId: randomUUID(),
              name: mintedName(input),
              kind: input.label,
            },
            mintedBytes(input)
          )
          return { op: "mint" as const, stageId: stage.stageId }
        }
        return {
          op: "edit" as const,
          prepared: await prepareCanvas(actor.userId, input),
        }
      },
      reversal: (input, output: CanvasResult) =>
        output.restore && input.op === "write"
          ? {
              command: "paper.undoWord",
              input: {
                doc: output.docId,
                revision: output.revision,
                restore: input.batch.basedOn,
              },
              expect: {
                query: "paper.read",
                input: { docId: output.docId },
                matches: { revision: output.revision },
                skipped: WORD_UNDO_MOVED,
              },
            }
          : null,
      step: entry.step,
      activity: (_input, output: CanvasResult) => ({
        subjectKind: "paper",
        subjectId: output.docId,
        summary: "Wrote on the page",
      }),
    },
    async (input, actor, ahead) => {
      const staged = canvasAhead(ahead)
      if (staged.op === "mint") {
        const published = await publishWordPackage(
          actor.userId,
          staged.stageId,
          PAPER_CANVAS_PROFILE
        )
        if (input.op === "mint" && input.jobId)
          await registry.execute({
            name: catalog["job.linkPaper"].name,
            input: {
              jobId: input.jobId,
              docId: published.docId,
              kind: input.label,
            },
            actor,
          })
        return resultOf(actor.userId, published.docId, published.revision, null)
      }
      const published = await commitWordCandidate(actor.userId, input, {
        candidate: staged.prepared.candidate,
        review: staged.prepared.review,
      })
      return resultOf(
        actor.userId,
        published.docId,
        published.revision,
        published.restore
      )
    }
  )
}
