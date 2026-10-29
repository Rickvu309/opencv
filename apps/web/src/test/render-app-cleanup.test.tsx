import { setTimeout as delay } from "node:timers/promises"
import { act, cleanup, waitFor } from "@testing-library/react"
import { expect, it, vi } from "vitest"

import { authClient } from "@/lib/auth-client.ts"
import { renderApp } from "./render-app.tsx"
import { cleanupTestResources } from "./test-resources.ts"

it("waits for an unmounted router's loader before restoring globals", async () => {
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const getSession = authClient.getSession.bind(authClient)
  const session = vi
    .spyOn(authClient, "getSession")
    .mockImplementationOnce(async () => {
      await gate
      return getSession()
    })
  try {
    const { queryClient, router } = renderApp("/jobs")
    await waitFor(() => expect(session).toHaveBeenCalled())
    cleanup()
    let finished = false
    const disposing = cleanupTestResources().then(() => {
      finished = true
    })
    await Promise.resolve()
    expect(finished).toBe(false)
    release()
    await act(() => disposing)
    expect(router.state.isLoading).toBe(false)
    expect(queryClient.getQueryCache().getAll()).toEqual([])
  } finally {
    release()
    session.mockRestore()
  }
})

it("cancels pending queries and removes their cache during cleanup", async () => {
  const { queryClient } = renderApp("/jobs")
  let signal: AbortSignal | undefined
  const query = queryClient.fetchQuery({
    queryKey: ["cleanup-regression"],
    queryFn: (context) => {
      signal = context.signal
      return new Promise(() => {})
    },
  })
  const cancelled = expect(query).rejects.toThrow()
  cleanup()
  await act(() => cleanupTestResources())
  await cancelled
  expect(signal?.aborted).toBe(true)
  expect(queryClient.isFetching()).toBe(0)
  expect(queryClient.getQueryCache().getAll()).toEqual([])
})

it("settles a transition offered just before unmount", async () => {
  const { router } = renderApp("/jobs")
  let offered = () => {}
  const transition = new Promise<void>((resolve) => {
    offered = resolve
  })
  const unsubscribe = router.subscribe("onBeforeRouteMount", () => {
    cleanup()
    offered()
  })
  await transition
  const disposing = cleanupTestResources()
  try {
    const result = await Promise.race([
      disposing.then(() => "disposed"),
      delay(1000, "still waiting"),
    ])
    expect(
      result,
      "cleanup must settle the abandoned React acknowledgement"
    ).toBe("disposed")
  } finally {
    unsubscribe()
    const owner = router._rendered
    const settle = owner?.[1]
    if (owner) owner.length = 0
    settle?.(false)
    await act(() => disposing)
  }
})

it("fails loudly on a stuck loader but still disposes history and queries", async () => {
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const getSession = authClient.getSession.bind(authClient)
  const session = vi
    .spyOn(authClient, "getSession")
    .mockImplementationOnce(async () => {
      await gate
      return getSession()
    })
  const { router, queryClient } = renderApp("/jobs")
  const destroy = vi.spyOn(router.history, "destroy")
  const clearCache = vi.spyOn(router, "clearCache")
  queryClient.setQueryData(["stuck-loader"], true)
  await waitFor(() => expect(session).toHaveBeenCalled())
  vi.useFakeTimers()
  cleanup()
  const disposing = cleanupTestResources()
  try {
    const error = await Promise.race([
      disposing.then(
        () => undefined,
        (error: unknown) => error
      ),
      delay(3000, undefined),
    ])
    expect(error).toBeInstanceOf(AggregateError)
    expect(String(error)).toContain("Test resource cleanup failed")
    if (!(error instanceof AggregateError))
      throw new Error("Expected cleanup error")
    expect(String(error.errors[0])).toContain(
      "Router cleanup timed out after 2000ms"
    )
    expect(destroy).toHaveBeenCalled()
    expect(clearCache).toHaveBeenCalled()
    expect(queryClient.getQueryCache().getAll()).toEqual([])
  } finally {
    vi.useRealTimers()
    release()
    await act(async () => {
      await router.load()
      await disposing.catch(() => {})
      await cleanupTestResources()
    })
    session.mockRestore()
  }
})
