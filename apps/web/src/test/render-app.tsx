import { createElement } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router"
import { render } from "@testing-library/react"

import { Toaster } from "@workspace/ui/components/sonner"

import { createQueryClient } from "@/lib/query-client.ts"
import { createAppRouter } from "@/router.tsx"
import { mockPublicConfig } from "@/test/auth-client-mock.ts"
import { applyApiFetch } from "@/test/apply-api-mock.ts"
import { pathOf } from "@/test/mock-http.ts"
import { paperApiFetch } from "@/test/paper-api-mock.ts"
import { profileApiFetch } from "@/test/profile-api-mock.ts"
import { shellApiFetch } from "@/test/shell-api-mock.ts"
import { chatApiFetch } from "@/test/chat-api-mock.ts"
import { vi } from "vitest"

import { registerTestCleanup } from "./test-resources.ts"

export function renderApp(
  initialEntry: string,
  onRequest?: (input: RequestInfo | URL) => void
) {
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      onRequest?.(input)
      if (pathOf(input) === "/api/public-config") {
        return Response.json({ google: mockPublicConfig.google })
      }
      const chat = await chatApiFetch(input, init)
      if (chat) return chat
      const apply = await applyApiFetch(input, init)
      if (apply) return apply
      const paper = await paperApiFetch(input, init)
      if (paper) return paper
      const profile = await profileApiFetch(input, init)
      if (profile) return profile
      const shell = await shellApiFetch(input, init)
      if (shell) return shell
      throw new Error(`Unexpected fetch: ${pathOf(input)}`)
    }
  )
  const queryClient = createQueryClient()
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })

  // Unmounting RouterProvider only unsubscribes from history. A loader can
  // still finish a lazy import or start a fetch after that unmount.
  const startTransition = router.startTransition
  const loads: Promise<void>[] = []
  const load = router.load.bind(router)
  router.load = (...args) => {
    const pending = load(...args)
    loads.push(pending)
    return pending
  }
  registerTestCleanup(async () => {
    // RouterProvider installs a React transition that cannot commit after unmount.
    router.startTransition = startTransition
    await Promise.all(loads)
    router.clearCache()
    router.history.destroy()
    await queryClient.cancelQueries()
    queryClient.clear()
  })

  return {
    router,
    queryClient,
    ...render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(Toaster),
        createElement(RouterProvider, { router })
      )
    ),
  }
}
