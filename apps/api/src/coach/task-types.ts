import type { coachTasks, taskCheckpoints, toolIntents } from "../db/schema.js"
export type { TaskLease } from "../registry/task-fence.js"
export type Task = typeof coachTasks.$inferSelect
export type Checkpoint = Pick<
  typeof taskCheckpoints.$inferInsert,
  | "completedStep"
  | "phase"
  | "modelMessages"
  | "observedRevisions"
  | "usage"
  | "requestManifest"
>
export type Intent = Pick<
  typeof toolIntents.$inferInsert,
  | "step"
  | "slot"
  | "intentKey"
  | "providerToolUseId"
  | "operation"
  | "operationVersion"
  | "input"
  | "inputHash"
  | "observedRevisions"
  | "kind"
>
