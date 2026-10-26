import { createElement } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router"
import { render } from "@testing-library/react"

import { createQueryClient } from "@/lib/query-client.ts"
import { createAppRouter } from "@/router.tsx"
import { mockPublicConfig } from "@/test/auth-client-mock.ts"
import { applyApiFetch } from "@/test/apply-api-mock.ts"
import { pathOf } from "@/test/mock-http.ts"
import { paperApiFetch } from "@/test/paper-api-mock.ts"
import { profileApiFetch } from "@/test/profile-api-mock.ts"
import { threadApiFetch } from "@/test/threads-api-mock.ts"
import { vi } from "vitest"

export function renderApp(
  initialEntry = "/",
  onRequest?: (input: RequestInfo | URL) => void
) {
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      onRequest?.(input)
      if (pathOf(input) === "/api/public-config") {
        return Response.json({ google: mockPublicConfig.google })
      }
      const apply = await applyApiFetch(input, init)
      if (apply) return apply
      const paper = await paperApiFetch(input, init)
      if (paper) return paper
      const profile = await profileApiFetch(input, init)
      if (profile) return profile
      return threadApiFetch(input, init)
    }
  )
  const queryClient = createQueryClient()
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })

  return {
    router,
    queryClient,
    ...render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(RouterProvider, { router })
      )
    ),
  }
}
