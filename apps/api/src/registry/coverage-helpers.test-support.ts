import type { TestDatabase } from "../db/context.js"
import type { ExecuteResult, Registry } from "./registry.js"

export function text(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object" || !(key in value)) {
    throw new Error(`missing ${key}`)
  }
  const field = (value as Record<string, unknown>)[key]
  if (field === null) return null
  if (typeof field !== "string") throw new Error(`missing ${key}`)
  return field
}

export function flag(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) {
    throw new Error(`missing ${key}`)
  }
  const field = (value as Record<string, unknown>)[key]
  if (typeof field !== "boolean") throw new Error(`missing ${key}`)
  return field
}

export function idOf(value: unknown) {
  const id = text(value, "id")
  if (!id) throw new Error("missing id")
  return id
}

export function record(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) {
    throw new Error(`missing ${key}`)
  }
  const field = (value as Record<string, unknown>)[key]
  if (!field || typeof field !== "object" || Array.isArray(field)) {
    throw new Error(`missing ${key}`)
  }
  return field as Record<string, unknown>
}

export function list(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) {
    throw new Error(`missing ${key}`)
  }
  const field = (value as Record<string, unknown>)[key]
  if (!Array.isArray(field)) throw new Error(`missing ${key}`)
  return field
}

export type CoverageCtx = {
  chatId: string
  jobId: string
  docId: string
  otherDocId: string
  itemId: string
  pendingId: string
  activityId: string
  fileId: string
}

export type CoverageCase = {
  name: string
  arrange: () => Promise<void>
  act: () => Promise<ExecuteResult>
  assert: (result: ExecuteResult) => Promise<void>
  undoAssert?: (result: ExecuteResult) => Promise<void>
}

export type CoverageTools = {
  db: TestDatabase
  registry: Registry
  userId: string
  ctx: CoverageCtx
  run: (name: string, input: unknown) => Promise<ExecuteResult>
  undo: (result: ExecuteResult) => Promise<void>
  jobOf: (jobId: string) => Promise<unknown>
  chatOf: (chatId: string) => Promise<unknown>
  paperOf: (docId: string) => Promise<unknown>
  profileOf: () => Promise<unknown>
  gone: (read: Promise<unknown>) => Promise<void>
  checklist: (itemId: string) => Promise<{ label: string; done: boolean }[]>
}
