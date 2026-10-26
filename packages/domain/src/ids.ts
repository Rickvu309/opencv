const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

declare const brand: unique symbol

type Brand<TName extends string> = string & { readonly [brand]: TName }

export type UserId = Brand<"UserId">
export type ChatId = Brand<"ChatId">
export type PaperId = Brand<"PaperId">
export type JobId = Brand<"JobId">
export type ActivityId = Brand<"ActivityId">
export type PendingActionId = Brand<"PendingActionId">
export type FileId = Brand<"FileId">

export function parseUserId(value: string): UserId {
  const trimmed = value.trim()
  if (!trimmed) throw new Error("Invalid user id")
  return trimmed as UserId
}

function parseUuid<TName extends string>(value: string, label: string): Brand<TName> {
  if (!uuidPattern.test(value)) throw new Error(`Invalid ${label}`)
  return value as Brand<TName>
}

export function parseChatId(value: string): ChatId {
  return parseUuid(value, "chat id")
}

export function parsePaperId(value: string): PaperId {
  return parseUuid(value, "paper id")
}

export function parseJobId(value: string): JobId {
  return parseUuid(value, "job id")
}

export function parseActivityId(value: string): ActivityId {
  return parseUuid(value, "activity id")
}

export function parsePendingActionId(value: string): PendingActionId {
  return parseUuid(value, "pending action id")
}

export function parseFileId(value: string): FileId {
  return parseUuid(value, "file id")
}
