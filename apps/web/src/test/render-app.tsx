import { createElement } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router"
import { render } from "@testing-library/react"

import { createQueryClient } from "@/lib/query-client.ts"
import { createAppRouter } from "@/router.tsx"

export function renderApp(initialEntry = "/") {
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
