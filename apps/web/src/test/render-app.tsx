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
import { bindTestRouter } from "@/test/go-home.ts"
import { vi } from "vitest"

export function renderApp(
  initialEntry = "/app/home",
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
  bindTestRouter(router)

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
