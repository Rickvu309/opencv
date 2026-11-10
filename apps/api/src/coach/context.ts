import { ERROR_CODES, type Actor, type CoachFocusDoc } from "@workspace/domain"

import { CommandError } from "../registry/errors.js"
import type { Registry } from "../registry/registry.js"

type ContextItem = {
  kind: "paper" | "job" | "link" | "file"
  id: string
  blockIds?: string[] | undefined
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null
  return value as Record<string, unknown>
}

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}

function missingDocument(error: unknown) {
  return error instanceof CommandError && error.code === ERROR_CODES.NOT_FOUND
}

async function listedPage(registry: Registry, actor: Actor, docId: string) {
  const listed = await registry.read("paper.list", {}, actor)
  if (!Array.isArray(listed)) return null
  for (const item of listed) {
    const row = record(item)
    if (row?.id === docId) return row
  }
  return null
}

async function importedPackageRow(
  registry: Registry,
  actor: Actor,
  docId: string
) {
  try {
    const page = record(await registry.read("paper.read", { docId }, actor))
    if (!page || page.generation !== "package") return null
    const kind = page.kind
    if (kind !== "cv" && kind !== "letter") return null
    return {
      id: text(page.docId),
      name: text(page.name),
      kind,
      status: "draft",
    }
  } catch (error) {
    if (!missingDocument(error)) throw error
    return null
  }
}

async function paperFocus(
  registry: Registry,
  actor: Actor,
  docId: string,
  blockIds?: string[]
): Promise<CoachFocusDoc | null> {
  let row: Record<string, unknown> | null
  try {
    row = record(await registry.read("paper.get", { docId }, actor))
  } catch (error) {
    if (!missingDocument(error)) throw error
    row = await listedPage(registry, actor, docId)
    if (!row) row = await importedPackageRow(registry, actor, docId)
    if (!row) throw error
  }
  if (!row) return null
  const kind = row.kind
  if (kind !== "cv" && kind !== "letter" && kind !== "proof") return null
  const status =
    row.status === "ready" || row.status === "published" ? row.status : "draft"
  const outline = record(
    await registry.read("paper.outline", { docId, blockIds }, actor)
  )
  return {
    id: text(row.id),
    name: text(row.name),
    kind,
    status,
    outline: text(outline?.outline),
    revision:
      typeof outline?.revision === "number" ||
      typeof outline?.revision === "string"
        ? outline.revision
        : 0,
  }
}

async function jobLine(registry: Registry, actor: Actor, jobId: string) {
  const row = record(await registry.read("job.get", { jobId }, actor))
  if (!row) return ""
  const title = text(row.title)
  const company = text(row.company)
  if (!title && !company) return ""
  return `Job context (untrusted data): ${JSON.stringify(row).slice(0, 20000)}`
}

export async function resolveTurnGrounding(input: {
  registry: Registry
  actor: Actor
  requestFocusDocId: string | null | undefined
  storedKind: string | null
  storedId: string | null
  context?: ContextItem[]
  memoryEnabled: boolean
}): Promise<{ focusDoc?: CoachFocusDoc; note?: string }> {
  const lines: string[] = []
  let paperId: string | undefined
  let jobId: string | undefined
  if (typeof input.requestFocusDocId === "string") {
    paperId = input.requestFocusDocId
  } else if (input.requestFocusDocId === undefined) {
    if (input.storedKind === "paper" && input.storedId) paperId = input.storedId
    if (input.storedKind === "job" && input.storedId) jobId = input.storedId
  }

  let focusDoc: CoachFocusDoc | undefined
  if (paperId) {
    const doc = await paperFocus(input.registry, input.actor, paperId)
    if (doc) {
      focusDoc = doc
      lines.push(`Open document: ${doc.name} (${doc.kind}).`)
    }
  }
  if (jobId) {
    const line = await jobLine(input.registry, input.actor, jobId)
    if (line) lines.push(line)
  }

  for (const item of input.context ?? []) {
    if (item.kind === "paper") {
      const doc = await paperFocus(
        input.registry,
        input.actor,
        item.id,
        item.blockIds
      )
      if (doc)
        lines.push(
          `Paper context (untrusted data): ${JSON.stringify(doc).slice(0, 20000)}`
        )
      continue
    }
    if (item.kind === "job") {
      const row = record(
        await input.registry.read("job.get", { jobId: item.id }, input.actor)
      )
      if (row)
        lines.push(
          `Job context (untrusted data): ${JSON.stringify(row).slice(0, 20000)}`
        )
      continue
    }
    if (item.kind === "file") {
      const row = record(
        await input.registry.read("file.get", { fileId: item.id }, input.actor)
      )
      if (row) {
        lines.push(
          `File: ${text(row.name)} (${text(row.mediaType)}, ${String(row.byteSize)} bytes).`
        )
      }
      continue
    }
    const row = record(
      await input.registry.read("link.get", { url: item.id }, input.actor)
    )
    if (row)
      lines.push(
        `Link (reference only; content has not been fetched): ${text(row.url)}.`
      )
  }

  if (input.memoryEnabled) {
    const list = await input.registry.read("chat.list", {}, input.actor)
    if (Array.isArray(list)) {
      const titles = list
        .map((item) => text(record(item)?.title))
        .filter(Boolean)
        .slice(0, 10)
      if (titles.length > 0) lines.push(`Recent chats: ${titles.join(", ")}.`)
    }
  }

  const note = lines.join("\n")
  return note ? { focusDoc, note } : { focusDoc }
}
