import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import type {
  CommandInput,
  CommandOutput,
  AnyCommandEntry,
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

export function activityKey(subjectKind: string, subjectId: string) {
  return queryKey({ query: "activity.list", input: { subjectKind, subjectId } })
}

export const ACTIVITY_ROOT = ["activity.list"] as const

export function refreshQueries(queryClient: QueryClient, refs: QueryRef[]) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ACTIVITY_ROOT }),
    ...refs.map((ref) =>
      queryClient.invalidateQueries({ queryKey: queryKey(ref) })
    ),
  ])
}

export function refreshReads(queryClient: QueryClient, refs: QueryRef[]) {
  return Promise.all(
    refs.map((ref) =>
      queryClient.invalidateQueries({ queryKey: queryKey(ref) })
    )
  )
}

export type RunOptions = {
  refresh?: boolean
  keepalive?: boolean
}

export type CommandResult<T> = T & { activityId?: string }

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
      ...((commands[name] as AnyCommandEntry).idempotency === "none"
        ? {}
        : { idempotencyKey: crypto.randomUUID() }),
    }),
    ...(options.keepalive ? { keepalive: true } : {}),
  })
  if (options.refresh !== false) {
    await refreshQueries(
      queryClient,
      commands[name].invalidates(input as never)
    )
  }
  return unwrapData(body)
}

export async function undoActivity(
  queryClient: QueryClient,
  activityId: string
) {
  return runContractCommand(queryClient, "activity.undo", {
    activityId: parseActivityId(activityId),
  })
}

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
