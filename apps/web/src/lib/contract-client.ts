import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import type {
  CommandInput,
  CommandOutput,
  Commands,
  ContractCommandName,
  QueryRef,
} from "@workspace/domain"
import { commands } from "@workspace/domain"

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
export async function runContractCommand<N extends ContractCommandName>(
  queryClient: QueryClient,
  name: N,
  input: CommandInput<Commands, N>,
  options: { refresh?: boolean } = {}
): Promise<CommandResult<CommandOutput<Commands, N>>> {
  const body = await apiFetch<
    SuccessBody<CommandResult<CommandOutput<Commands, N>>>
  >(`/api/commands/${name}`, {
    method: "POST",
    body: JSON.stringify({ input, idempotencyKey: crypto.randomUUID() }),
  })
  if (options.refresh !== false) {
    void refreshQueries(queryClient, commands[name].invalidates(input as never))
  }
  return unwrapData(body)
}

/** `runContractCommand` bound to the app's QueryClient. */
export function useRunCommand() {
  const queryClient = useQueryClient()
  return useCallback(
    <N extends ContractCommandName>(
      name: N,
      input: CommandInput<Commands, N>,
      options?: { refresh?: boolean }
    ) => runContractCommand(queryClient, name, input, options),
    [queryClient]
  )
}
