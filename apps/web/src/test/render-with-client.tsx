import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render as rtlRender } from "@testing-library/react"
import type { ReactElement } from "react"

import { registerTestCleanup } from "./test-resources.ts"

/** Renders a component that runs contract commands, which need a QueryClient. */
export function render(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  registerTestCleanup(async () => {
    await client.cancelQueries()
    client.clear()
  })
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
}
