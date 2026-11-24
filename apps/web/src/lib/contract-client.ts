import {
  queryOptions,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import { useCallback } from "react"
import type {
  CommandInput,
  CommandOutput,
  AnyCommandEntry,
  Commands,
  ContractCommandName,
  QueryRef,
  Operation,
  OperationInput,
  OperationOutput,
  ResourceTouch,
} from "@workspace/domain"
import {
  catalog,
  NATIVE_WRITER,
  commands,
  parseActivityId,
  resourcesOverlap,
} from "@workspace/domain"

import { z } from "@workspace/domain"
import { endpoints } from "@/lib/requests.ts"

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
  signal?: AbortSignal
  keepalive?: boolean
  idempotencyKey?: string
}

export type CommandResult<T> = T & { activityId?: string }

const pendingSchema = z
  .object({
    pending: z.literal(true),
    pendingActionId: z.string(),
    activityId: z.null(),
    reversal: z.null(),
  })
  .passthrough()

function isPending(output: unknown) {
  return pendingSchema.safeParse(output)
}

function paperCommandInput(name: string, input: unknown) {
  if (
    (name === "paper.rename" ||
      name === "paper.duplicate" ||
      name === "paper.setStatus") &&
    input !== null &&
    typeof input === "object" &&
    !("writer" in input)
  )
    return { ...input, writer: NATIVE_WRITER }
  return input
}

type PairCommandName = WriteName<typeof catalog>
export type RunnableCommandName = ContractCommandName | PairCommandName
type RunnableInput<N extends RunnableCommandName> =
  N extends ContractCommandName
    ? CommandInput<Commands, N>
    : N extends PairCommandName
      ? OperationInput<(typeof catalog)[N]>
      : never
type RunnableOutput<N extends RunnableCommandName> =
  N extends ContractCommandName
    ? CommandOutput<Commands, N>
    : N extends PairCommandName
      ? OperationOutput<(typeof catalog)[N]>
      : never

function listedCommand(name: string): AnyCommandEntry | undefined {
  return (commands as Record<string, AnyCommandEntry>)[name]
}

function pairOperation(name: string): Operation | undefined {
  return (catalog as Record<string, Operation>)[name]
}

function refreshReadsNoPairDeclares(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] !== "catalog" &&
      !pairOperation(String(query.queryKey[0])),
  })
}

export async function runContractCommand<N extends RunnableCommandName>(
  queryClient: QueryClient,
  name: N,
  input: RunnableInput<N>,
  options: RunOptions = {}
): Promise<CommandResult<RunnableOutput<N>>> {
  const listed = listedCommand(name)
  const idempotency = listed
    ? listed.idempotency
    : (pairOperation(name) as { idempotency?: string }).idempotency
  const body = await apiFetch<SuccessBody<CommandResult<RunnableOutput<N>>>>(
    `/api/commands/${name}`,
    {
      method: "POST",
      body: JSON.stringify({
        input: paperCommandInput(name, input),
        ...(idempotency === "none"
          ? {}
          : { idempotencyKey: options.idempotencyKey ?? crypto.randomUUID() }),
      }),
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.keepalive ? { keepalive: true } : {}),
    }
  )
  if (options.refresh !== false && !isPending(unwrapData(body)).success) {
    await refreshCatalogReads(queryClient, commandTouches(body))
    if (listed) await refreshQueries(queryClient, listed.invalidates(input))
    else
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ACTIVITY_ROOT }),
        refreshReadsNoPairDeclares(queryClient),
      ])
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
    <N extends RunnableCommandName>(
      name: N,
      input: RunnableInput<N>,
      options?: RunOptions
    ) => runContractCommand(queryClient, name, input, options),
    [queryClient]
  )
}

const touchSchema = z.object({
  ownerId: z.string(),
  name: z.string(),
  entityId: z.string().optional(),
})
const metadataSchema = z.object({
  meta: z.object({ touches: z.array(touchSchema) }).optional(),
})

function commandTouches(body: unknown) {
  return metadataSchema.parse(body).meta?.touches
}

function touchedUnderItsOwnName(
  queryKey: readonly unknown[],
  touches: ResourceTouch[] | undefined
) {
  const operation = pairOperation(String(queryKey[0]))
  if (!operation || operation.kind !== "read") return false
  if (touches === undefined) return true
  const input = operation.input.safeParse(queryKey[1] ?? {})
  if (!input.success) return true
  const dependencies = operation.dependsOn(input.data as never)
  return touches.some((touch) =>
    dependencies.some(({ name, entityId }) =>
      resourcesOverlap(touch, {
        ownerId: touch.ownerId,
        name,
        ...(entityId ? { entityId } : {}),
      })
    )
  )
}

export function refreshCatalogReads(
  queryClient: QueryClient,
  touches?: ResourceTouch[]
) {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      if (query.queryKey[0] !== "catalog")
        return touchedUnderItsOwnName(query.queryKey, touches)
      const dependencies = z.array(touchSchema).safeParse(query.meta?.dependsOn)
      return (
        dependencies.success &&
        (touches === undefined ||
          touches.some((touch) =>
            dependencies.data.some((dependency) =>
              resourcesOverlap(touch, dependency)
            )
          ))
      )
    },
  })
}

export async function readOperation<N extends ReadName<typeof catalog>>(
  name: N,
  input: OperationInput<(typeof catalog)[N]>,
  signal?: AbortSignal
): Promise<OperationOutput<(typeof catalog)[N]>> {
  const body = await apiFetch<SuccessBody<unknown>>(
    endpoints.catalogRead(name),
    {
      method: "POST",
      body: JSON.stringify(input),
      ...(signal ? { signal } : {}),
    }
  )
  return catalog[name].publicResult.parse(unwrapData(body)) as OperationOutput<
    (typeof catalog)[N]
  >
}

type ReadName<C extends Record<string, Operation>> = {
  [N in keyof C]: C[N]["kind"] extends "read" ? N : never
}[keyof C] &
  string
type WriteName<C extends Record<string, Operation>> = {
  [N in keyof C]: C[N]["kind"] extends "command" ? N : never
}[keyof C] &
  string

export function createCatalogClient<const C extends Record<string, Operation>>(
  catalog: C
) {
  function key<N extends ReadName<C>>(
    ownerId: string,
    name: N,
    input: OperationInput<C[N]>
  ) {
    return [
      "catalog",
      ownerId,
      name,
      catalog[name]!.input.parse(input) as z.output<C[N]["input"]>,
    ] as const
  }
  function options<N extends ReadName<C>>(
    ownerId: string,
    name: N,
    input: OperationInput<C[N]>
  ) {
    const operation = catalog[name]!
    if (operation.kind !== "read") throw new Error("Expected catalog read")
    const parsed = operation.input.parse(input)
    return queryOptions({
      queryKey: key(ownerId, name, input),
      meta: {
        dependsOn: operation
          .dependsOn(parsed as never)
          .map(({ name, entityId }) => ({
            ownerId,
            name,
            ...(entityId ? { entityId } : {}),
          })),
      },
      queryFn: async ({ signal }): Promise<OperationOutput<C[N]>> => {
        const body = await apiFetch<SuccessBody<unknown>>(
          endpoints.catalogRead(name),
          { method: "POST", body: JSON.stringify(input), signal }
        )
        return operation.publicResult.parse(
          unwrapData(body)
        ) as OperationOutput<C[N]>
      },
    })
  }
  async function run<N extends WriteName<C>>(
    queryClient: QueryClient,
    name: N,
    input: OperationInput<C[N]>,
    runOptions: RunOptions = {}
  ): Promise<
    | OperationOutput<C[N]>
    | CommandResult<OperationOutput<C[N]>>
    | z.output<typeof pendingSchema>
  > {
    const operation = catalog[name]!
    if (operation.kind !== "command")
      throw new Error("Expected catalog command")
    const body = await apiFetch<SuccessBody<unknown>>(
      endpoints.catalogCommand(name),
      {
        method: "POST",
        body: JSON.stringify({
          input,
          ...(operation.idempotency === "none"
            ? {}
            : { idempotencyKey: crypto.randomUUID() }),
        }),
        ...(runOptions.signal ? { signal: runOptions.signal } : {}),
        ...(runOptions.keepalive ? { keepalive: true } : {}),
      }
    )
    const data = unwrapData(body)
    const pending = isPending(data)
    if (pending.success) return pending.data
    const activity = z
      .object({ activityId: z.string().optional() })
      .safeParse(data)
    const output = operation.publicResult.parse(data) as OperationOutput<C[N]>
    if (runOptions.refresh !== false) {
      await Promise.all([
        refreshCatalogReads(queryClient, commandTouches(body)),
        refreshReadsNoPairDeclares(queryClient),
      ])
    }
    return activity.success &&
      activity.data.activityId &&
      output !== null &&
      typeof output === "object" &&
      !Array.isArray(output)
      ? { ...output, activityId: activity.data.activityId }
      : output
  }
  function useRead<N extends ReadName<C>>(
    ownerId: string,
    name: N,
    input: OperationInput<C[N]>
  ) {
    return useQuery(options(ownerId, name, input))
  }
  return { key, options, run, useRead }
}

export const catalogClient = createCatalogClient(catalog)
