import type { Actor, CoachFocusDoc } from "@workspace/domain"

import type { Registry } from "../registry/registry.js"

type ContextItem = { kind: "paper" | "job" | "link" | "file"; id: string }

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null
  return value as Record<string, unknown>
}

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}

async function paperFocus(
  registry: Registry,
  actor: Actor,
  docId: string
): Promise<CoachFocusDoc | null> {
  const row = record(await registry.read("paper.get", { docId }, actor))
  if (!row) return null
  const kind = row.kind
  if (kind !== "cv" && kind !== "letter" && kind !== "proof") return null
  const status =
    row.status === "ready" || row.status === "published" ? row.status : "draft"
  return {
    id: text(row.id),
    name: text(row.name),
    kind,
    status,
    content: row.document,
    contentVersion:
      typeof row.contentVersion === "number" ? row.contentVersion : 0,
  }
}

async function jobLine(registry: Registry, actor: Actor, jobId: string) {
  const row = record(await registry.read("job.get", { jobId }, actor))
  if (!row) return ""
  const title = text(row.title)
  const company = text(row.company)
  if (!title && !company) return ""
  return `Open job: ${title} at ${company}.`
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
      const doc = await paperFocus(input.registry, input.actor, item.id)
      if (doc) lines.push(`Paper: ${doc.name} (${doc.kind}).`)
      continue
    }
    if (item.kind === "job") {
      const row = record(
        await input.registry.read("job.get", { jobId: item.id }, input.actor)
      )
      if (row) lines.push(`Job: ${text(row.title)} at ${text(row.company)}.`)
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
    if (row) lines.push(`Link: ${text(row.host) || text(row.url)}.`)
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
