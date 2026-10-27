import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import type {
  CommandInput,
  CommandOutput,
  JobCommandName,
  JobContract,
  QueryRef,
} from "@workspace/domain"
import { jobContract } from "@workspace/domain"

import { apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"

export function queryKey(ref: QueryRef): readonly unknown[] {
  return ref.input ? [ref.query, ref.input] : [ref.query]
}

/** Activity reads are not a registered query yet, and any command may write a row. */
export function activityKey(subjectId: string): readonly unknown[] {
  return ["activity", subjectId]
}

export const ACTIVITY_ROOT = ["activity"] as const

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

export type CommandResult<T> = T & { activityId?: string }

/**
 * Runs a contract command, then refreshes the reads its contract entry
 * says it invalidates. Named apart from the legacy `runCommand` in
 * api-envelope.ts, which sends no idempotency key and refreshes nothing.
 */
export async function runContractCommand<N extends JobCommandName>(
  queryClient: QueryClient,
  name: N,
  input: CommandInput<JobContract, N>
): Promise<CommandResult<CommandOutput<JobContract, N>>> {
  const body = await apiFetch<
    SuccessBody<CommandResult<CommandOutput<JobContract, N>>>
  >(`/api/commands/${name}`, {
    method: "POST",
    body: JSON.stringify({ input, idempotencyKey: crypto.randomUUID() }),
  })
  const refs = jobContract[name].invalidates(input as never)
  void refreshQueries(queryClient, refs)
  return unwrapData(body)
}

/** `runContractCommand` bound to the app's QueryClient. */
export function useRunCommand() {
  const queryClient = useQueryClient()
  return useCallback(
    <N extends JobCommandName>(name: N, input: CommandInput<JobContract, N>) =>
      runContractCommand(queryClient, name, input),
    [queryClient]
  )
}
