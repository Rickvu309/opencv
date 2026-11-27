import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query"
import type {
  QueryRef,
  Operation,
  OperationInput,
  OperationOutput,
  ResourceTouch,
} from "@workspace/domain/kernel"
import { catalog, resourcesOverlap } from "@workspace/domain/kernel"

import { z } from "@workspace/domain/kernel"
import { endpoints } from "@/lib/requests.ts"

import { apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"

export function queryKey(ref: QueryRef): readonly unknown[] {
  return ref.input ? [ref.query, ref.input] : [ref.query]
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

export async function undoActivity(
  queryClient: QueryClient,
  activityId: string
) {
  return catalogClient.run(queryClient, catalog["activity.undo"].name, {
    activityId,
  })
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

export function refreshCatalogReads(
  queryClient: QueryClient,
  touches?: ResourceTouch[]
) {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      if (query.queryKey[0] !== "catalog") return false
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
  async function requestRead<N extends ReadName<C> | WriteName<C>>(
    name: N,
    input: OperationInput<C[N]>,
    readOptions: { signal?: AbortSignal }
  ): Promise<OperationOutput<C[N]>> {
    const operation = catalog[name]!
    if (operation.kind !== "read") throw new Error("Expected catalog read")
    const body = await apiFetch<SuccessBody<unknown>>(
      endpoints.catalogRead(name),
      {
        method: "POST",
        body: JSON.stringify(input),
        ...(readOptions.signal ? { signal: readOptions.signal } : {}),
      }
    )
    return operation.publicResult.parse(unwrapData(body)) as OperationOutput<
      C[N]
    >
  }
  function read<N extends ReadName<C>>(
    name: N,
    input: OperationInput<C[N]>,
    readOptions: { signal?: AbortSignal } = {}
  ) {
    return requestRead(name, input, readOptions)
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
      queryFn: ({ signal }): Promise<OperationOutput<C[N]>> =>
        read(name, input, { signal }),
    })
  }
  function run<N extends ReadName<C>>(
    queryClient: QueryClient,
    name: N,
    input: OperationInput<C[N]>,
    runOptions?: RunOptions
  ): Promise<OperationOutput<C[N]>>
  function run<N extends WriteName<C>>(
    queryClient: QueryClient,
    name: N,
    input: OperationInput<C[N]>,
    runOptions?: RunOptions
  ): Promise<
    | OperationOutput<C[N]>
    | CommandResult<OperationOutput<C[N]>>
    | z.output<typeof pendingSchema>
  >
  async function run<N extends ReadName<C> | WriteName<C>>(
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
    if (operation.kind === "read") return requestRead(name, input, runOptions)
    const body = await apiFetch<SuccessBody<unknown>>(
      endpoints.catalogCommand(name),
      {
        method: "POST",
        body: JSON.stringify({
          input,
          ...(operation.idempotency === "none"
            ? {}
            : {
                idempotencyKey:
                  runOptions.idempotencyKey ?? crypto.randomUUID(),
              }),
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
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] !== "catalog",
        }),
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
  return { key, options, read, run, useRead }
}

export const catalogClient = createCatalogClient(catalog)
