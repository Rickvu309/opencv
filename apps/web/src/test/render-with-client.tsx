import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render as rtlRender } from "@testing-library/react"
import type { ReactElement } from "react"

import { registerTestCleanup } from "./test-resources.ts"

export function render(
  ui: ReactElement,
  { coachDurable = false }: { coachDurable?: boolean } = {}
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(["coach-config"], { coachDurable })
  registerTestCleanup(async () => {
    try {
      await client.cancelQueries()
    } finally {
      client.clear()
    }
  })
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
}
