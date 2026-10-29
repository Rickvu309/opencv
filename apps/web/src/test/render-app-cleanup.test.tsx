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
