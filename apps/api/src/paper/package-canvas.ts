import { randomUUID } from "node:crypto"
import { createRequire } from "node:module"

import {
  ERROR_CODES,
  PAPER_CANVAS_PROFILE,
  paperContract,
  paperPackageEditResultSchema,
  type PaperCanvasCommit,
  type WordBatch,
} from "@workspace/domain"
import { and, eq } from "drizzle-orm"

import { getDb, insideTransaction, transaction } from "../db/context.js"
import { paperPackageHeads } from "../db/schema.js"
import { CommandError } from "../registry/errors.js"
import type { Registry } from "../registry/registry.js"
import { commitWordCandidate } from "./package-candidates.js"
import { packageFailure } from "./package-pages.js"
import {
  publishWordPackage,
  readWordPackage,
  stageWordPackage,
  wordPackageBasis,
} from "./package-store.js"
import { open, prepareBatch } from "./word/document.js"

const loaded = createRequire(import.meta.url)(
  "../../../../scripts/lib/paper-canvas-bytes.mjs"
) as {
  mintBlankBytes: () => Uint8Array
}

type CanvasResult = ReturnType<typeof paperPackageEditResultSchema.parse>

function requireEnabled() {
  if (process.env.PAPER_PACKAGE_ENABLED !== "true")
    throw new CommandError(
      ERROR_CODES.NOT_FOUND,
      "Saved Word documents are unavailable."
    )
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

async function resultOf(
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

type CanvasEdit = Exclude<PaperCanvasCommit, { op: "mint" }>

const unavailableChange =
  "This page change is not available. No document was changed."

async function batchOf(owner: string, input: CanvasEdit): Promise<WordBatch> {
  const at = { doc: input.docId, basedOn: input.basedOn }
  const page = await open(owner, {
    kind: "read",
    doc: input.docId,
    at: input.basedOn,
  })
  const index =
    "refused" in page
      ? -1
      : page.paragraphs.findIndex(
          (paragraph) => paragraph.handle === input.paragraph
        )
  if (input.op === "deleteParagraph") {
    if (!("refused" in page) && (page.paragraphs[index]?.text ?? "") !== "")
      return packageFailure(unavailableChange)
    return { ...at, ops: [{ op: "delete", handle: input.paragraph }] }
  }
  if ("refused" in page) return packageFailure(unavailableChange)
  const target = page.paragraphs[index]
  if (!target || target.held) return packageFailure(unavailableChange)
  if (input.op === "writeText") {
    if (target.text !== "") return packageFailure(unavailableChange)
    return {
      ...at,
      ops: [{ op: "setText", handle: target.handle, text: input.text }],
    }
  }
  if (input.op === "split") {
    const letters = [...target.text]
    if (input.at > letters.length) return packageFailure(unavailableChange)
    return {
      ...at,
      ops: [
        {
          op: "setText",
          handle: target.handle,
          text: letters.slice(0, input.at).join(""),
        },
        {
          op: "insert",
          after: target.handle,
          text: letters.slice(input.at).join(""),
        },
      ],
    }
  }
  const kept = page.paragraphs[index - 1]
  if (!kept || kept.held) return packageFailure(unavailableChange)
  return {
    ...at,
    ops: [
      { op: "setText", handle: kept.handle, text: kept.text + target.text },
      { op: "delete", handle: target.handle },
    ],
  }
}

const storeRefusals = new Set([
  "IN_TRANSACTION",
  "PROJECTION",
  "PROJECTION_BYTES",
  "STORE",
])

export async function prepareCanvas(owner: string, input: CanvasEdit) {
  if (insideTransaction())
    return packageFailure("Prepare the Word edit before starting a save.")
  await wordPackageBasis(owner, input.docId, input.basedOn)
  const drafted = await prepareBatch(owner, await batchOf(owner, input), input)
  if (!drafted.refused) return drafted.prepared
  if (drafted.reason === "stale")
    return packageFailure(
      "This Word document has changed. Read it again before editing."
    )
  return packageFailure(
    storeRefusals.has(drafted.code ?? "") ? drafted.message : unavailableChange
  )
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
        if (process.env.PAPER_PACKAGE_ENABLED !== "true") {
          try {
            await transaction(async () => {
              requireEnabled()
            })
          } catch (error) {
            if (error instanceof CommandError) throw error
            requireEnabled()
          }
        }
        if (input.op === "mint") {
          const stage = await stageWordPackage(
            actor.userId,
            { requestId: randomUUID(), name: "Page.docx", kind: "letter" },
            loaded.mintBlankBytes()
          )
          return { op: "mint" as const, stageId: stage.stageId }
        }
        return {
          op: "edit" as const,
          prepared: await prepareCanvas(actor.userId, input),
        }
      },
      reversal: (_input, output: CanvasResult) =>
        output.restore
          ? {
              command: "paper.restoreWord",
              input: {
                docId: output.docId,
                candidate: output.restore,
                expectedRevision: output.revision,
              },
              expect: {
                query: "paper.read",
                input: { docId: output.docId },
                matches: { revision: output.revision },
                skipped:
                  "This Word document changed after the edit, so Undo was skipped.",
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
