import {
  coachTaskEventSchema,
  chatToolNameSchema,
  coachTaskSnapshotSchema,
  type ChatEntryPart,
} from "@workspace/domain"

export type TaskSnapshot = ReturnType<typeof coachTaskSnapshotSchema.parse>
export type TaskEvent = ReturnType<typeof coachTaskEventSchema.parse>
export type CoachTaskState = {
  snapshot: TaskSnapshot
  cursor: number
  attempt: number
  draft: string
  needsSnapshot: boolean
  reconnecting: boolean
}
export type CoachTaskAction =
  | { type: "snapshot"; snapshot: TaskSnapshot }
  | { type: "event"; event: TaskEvent }
  | { type: "disconnected" }

function draftText(payload: unknown) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("text" in payload) ||
    typeof payload.text !== "string"
  )
    throw new Error("Invalid Coach draft")
  return payload.text
}
const stateSchema = coachTaskSnapshotSchema.pick({ state: true })

export function taskIsTerminal(state: TaskSnapshot["state"]) {
  return state === "succeeded" || state === "failed" || state === "cancelled"
}

export function taskFromSnapshot(snapshot: TaskSnapshot): CoachTaskState {
  let draft = ""
  let attempt = 0
  for (const event of snapshot.events) {
    if (event.kind === "attemptRestarted" || event.attempt > attempt) draft = ""
    attempt = event.attempt
    if (event.kind === "draft") draft += draftText(event.payload)
  }
  return {
    snapshot,
    cursor: snapshot.cursor,
    attempt,
    draft,
    needsSnapshot: false,
    reconnecting: false,
  }
}

export function coachTaskReducer(
  state: CoachTaskState,
  action: CoachTaskAction
): CoachTaskState {
  if (action.type === "disconnected") return { ...state, reconnecting: true }
  if (action.type === "snapshot") {
    if (
      action.snapshot.taskId !== state.snapshot.taskId ||
      action.snapshot.cursor < state.cursor
    )
      return state
    return taskFromSnapshot(action.snapshot)
  }
  const event = action.event
  if (event.taskId !== state.snapshot.taskId || event.seq <= state.cursor)
    return state
  if (event.seq !== state.cursor + 1) return { ...state, needsSnapshot: true }
  const restarted =
    event.kind === "attemptRestarted" || event.attempt > state.attempt
  const next = {
    ...state,
    cursor: event.seq,
    attempt: event.attempt,
    draft: restarted ? "" : state.draft,
    reconnecting: false,
  }
  if (event.kind === "draft") next.draft += draftText(event.payload)
  if (event.kind === "state") {
    next.snapshot = { ...state.snapshot, ...stateSchema.parse(event.payload) }
    next.needsSnapshot = taskIsTerminal(next.snapshot.state)
  }
  if (event.kind === "action" || event.kind === "actionResolved" || restarted)
    next.needsSnapshot = true
  return next
}

export function taskParts(state: CoachTaskState): ChatEntryPart[] {
  return [
    ...(state.draft ? [{ type: "text" as const, text: state.draft }] : []),
    ...state.snapshot.actions
      .filter((action) => action.state !== "planned")
      .map((action): ChatEntryPart => {
        const confirmation = state.snapshot.confirmations.find(
          (item) => item.id === action.proposalId
        )
        const pending = confirmation?.status === "pending"
        return {
          type: "tool",
          name: chatToolNameSchema.parse(action.operation),
          toolCallId: action.toolCallId,
          summary: confirmation?.summary ?? action.operation,
          ok:
            action.state === "committed" || action.state === "read" || pending,
          ...(action.activityId ? { activityId: action.activityId } : {}),
          ...(pending && action.proposalId
            ? { pendingActionId: action.proposalId }
            : {}),
          ...(confirmation ? { approval: confirmation.status } : {}),
        }
      }),
  ]
}
