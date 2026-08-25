import { createElement, type ReactNode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThreadStoreProvider } from "@/features/home/thread-store.tsx"
import { toThreadListItems } from "@/features/home/thread-list-port.ts"
import { useThreadList } from "@/features/home/use-thread-list.ts"
import { createQueryClient } from "@/lib/query-client.ts"
import { FIXTURE_THREADS } from "@/test/thread-fixtures.ts"
import { installThreadApiMock } from "@/test/threads-api-mock.ts"

const here = path.dirname(fileURLToPath(import.meta.url))
const appShellDir = path.resolve(here, "../app-shell")

const SHELL_FILES = [
  "app-shell-layout.tsx",
  "app-sidebar.tsx",
  "sidebar-history.tsx",
  "search-modal.tsx",
  "search-threads.ts",
]

function wrapper({ children }: { children: ReactNode }) {
  installThreadApiMock()
  const client = createQueryClient()
  return createElement(
    QueryClientProvider,
    { client },
    createElement(ThreadStoreProvider, null, children)
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ThreadListPort", () => {
  it("exposes only id/title Threads plus list actions", async () => {
    const { result } = renderHook(() => useThreadList(), { wrapper })

    await waitFor(() => {
      expect(result.current.threads.length).toBe(FIXTURE_THREADS.length)
    })

    expect(Object.keys(result.current).sort()).toEqual([
      "activeThreadId",
      "newThread",
      "openThread",
      "threads",
    ])
    expect(result.current.activeThreadId).toBeNull()
    expect(result.current.threads[0]).toEqual({
      id: FIXTURE_THREADS[0]!.id,
      title: FIXTURE_THREADS[0]!.title,
    })
    expect(Object.keys(result.current.threads[0]!).sort()).toEqual([
      "id",
      "title",
    ])
    expect(result.current.threads[0]).not.toHaveProperty("messages")
  })

  it("strips message internals when mapping to the port", () => {
    expect(toThreadListItems(FIXTURE_THREADS)).toEqual(
      FIXTURE_THREADS.map(({ id, title }) => ({ id, title }))
    )
  })

  it("keeps HomeThread and the full store hook out of shell chrome", () => {
    for (const file of SHELL_FILES) {
      const src = readFileSync(path.join(appShellDir, file), "utf8")
      expect(src, file).not.toMatch(/HomeThread/)
      expect(src, file).not.toMatch(/useThreadStore/)
    }
  })
})
