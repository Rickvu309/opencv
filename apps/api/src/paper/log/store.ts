import type { Change, Document } from "@workspace/domain/paper-doc"

export type StoredChange = Change & {
  to: number
  released: string[]
  activity: string | null
}

export type LogHead = {
  engine: number
  headVersion: number
  snapshot: Document | null
  snapshotVersion: number
}

export interface OpenLog {
  readonly head: LogHead
  changesFrom(version: number): Promise<StoredChange[]>
  firstVersion(): Promise<number | null>
  byEdit(edit: string): Promise<StoredChange | null>
  add(change: StoredChange): Promise<void>
  moveHead(head: Partial<LogHead>): Promise<void>
  dropThrough(version: number): Promise<void>
}

export interface PaperLogStore {
  open<T>(
    docId: string,
    mode: "read" | "write",
    work: (log: OpenLog) => Promise<T>
  ): Promise<T | null>
}
