import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render as rtlRender } from "@testing-library/react"
import type { ReactElement } from "react"

import { registerTestCleanup } from "./test-resources.ts"

export function render(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
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
