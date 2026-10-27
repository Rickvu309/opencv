import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import type {
  CommandInput,
  CommandOutput,
  Commands,
  ContractCommandName,
  QueryRef,
} from "@workspace/domain"
import { commands, parseActivityId } from "@workspace/domain"

import { apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"

export function queryKey(ref: QueryRef): readonly unknown[] {
  return ref.input ? [ref.query, ref.input] : [ref.query]
}

/** Activity rows for one subject, as `activity.list` returns them. */
export function activityKey(subjectKind: string, subjectId: string) {
  return queryKey({ query: "activity.list", input: { subjectKind, subjectId } })
}

/** Any command may write an activity row, so every command refreshes this root. */
export const ACTIVITY_ROOT = ["activity.list"] as const

export function refreshQueries(queryClient: QueryClient, refs: QueryRef[]) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ACTIVITY_ROOT }),
    ...refs.map((ref) =>
      queryClient.invalidateQueries({ queryKey: queryKey(ref) })
    ),
  ])
}

/** Every job read, for writes the contract does not describe (undo, Coach). */
export function refreshJobQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ACTIVITY_ROOT }),
    queryClient.invalidateQueries({
      predicate: (query) =>
        typeof query.queryKey[0] === "string" &&
        query.queryKey[0].startsWith("job."),
    }),
  ])
}

/** Every paper and file read, for writes the contract does not describe (undo, Coach). */
export function refreshPaperQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ACTIVITY_ROOT }),
    queryClient.invalidateQueries({
      predicate: (query) =>
        typeof query.queryKey[0] === "string" &&
        (query.queryKey[0].startsWith("paper.") ||
          query.queryKey[0].startsWith("file.")),
    }),
  ])
}

export type RunOptions = {
  refresh?: boolean
  /** False for a write that already compares a version, so a replay cannot apply twice. */
  idempotencyKey?: boolean
}

export type CommandResult<T> = T & { activityId?: string }

/**
 * Runs a contract command, then refreshes the reads its contract entry
 * says it invalidates.
 */
export async function runContractCommand<N extends ContractCommandName>(
  queryClient: QueryClient,
  name: N,
  input: CommandInput<Commands, N>,
  options: RunOptions = {}
): Promise<CommandResult<CommandOutput<Commands, N>>> {
  const body = await apiFetch<
    SuccessBody<CommandResult<CommandOutput<Commands, N>>>
  >(`/api/commands/${name}`, {
    method: "POST",
    body: JSON.stringify({
      input,
      ...(options.idempotencyKey === false
        ? {}
        : { idempotencyKey: crypto.randomUUID() }),
    }),
  })
  if (options.refresh !== false) {
    await refreshQueries(
      queryClient,
      commands[name].invalidates(input as never)
    )
  }
  return unwrapData(body)
}

/** Undo refreshes everything the reversal may have touched, as the contract says. */
export async function undoActivity(
  queryClient: QueryClient,
  activityId: string
) {
  return runContractCommand(queryClient, "activity.undo", {
    activityId: parseActivityId(activityId),
  })
}

/** `runContractCommand` bound to the app's QueryClient. */
export function useRunCommand() {
  const queryClient = useQueryClient()
  return useCallback(
    <N extends ContractCommandName>(
      name: N,
      input: CommandInput<Commands, N>,
      options?: RunOptions
    ) => runContractCommand(queryClient, name, input, options),
    [queryClient]
  )
}
