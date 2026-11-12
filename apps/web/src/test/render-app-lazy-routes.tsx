import {
  setTimeout as setRealTimerUnaffectedByFakeTimers,
  clearTimeout as clearRealTimerUnaffectedByFakeTimers,
} from "node:timers"
import { createElement } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
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
        return Response.json({
          google: mockPublicConfig.google,
          coachDurable: false,
        })
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

  const startTransitionBeforeRouterProvider = router.startTransition
  const loadsThatMayOutliveUnmount: Promise<void>[] = []
  const load = router.load.bind(router)
  router.load = (...args) => {
    const pending = load(...args)
    loadsThatMayOutliveUnmount.push(pending)
    return pending
  }
  registerTestCleanup(async () => {
    const errors: unknown[] = []
    let timer: ReturnType<typeof setRealTimerUnaffectedByFakeTimers> | undefined
    try {
      router.startTransition = startTransitionBeforeRouterProvider
      const transitionerAcknowledgement = router._rendered
      const settleAsUnrendered = transitionerAcknowledgement?.[1]
      if (transitionerAcknowledgement) transitionerAcknowledgement.length = 0
      settleAsUnrendered?.(false)

      const results = await Promise.race([
        Promise.allSettled(loadsThatMayOutliveUnmount),
        new Promise<never>((_, reject) => {
          timer = setRealTimerUnaffectedByFakeTimers(() => {
            reject(new Error("Router cleanup timed out after 2000ms"))
          }, 2000)
        }),
      ])
      for (const result of results) {
        if (result.status === "rejected") errors.push(result.reason)
      }
    } catch (error) {
      errors.push(error)
    } finally {
      clearRealTimerUnaffectedByFakeTimers(timer)
      const disposalsThatRunEvenIfLoadingFailedOrNeverSettled = [
        () => router.clearCache(),
        () => router.history.destroy(),
        () => queryClient.cancelQueries(),
        () => queryClient.clear(),
      ]
      for (const dispose of disposalsThatRunEvenIfLoadingFailedOrNeverSettled) {
        try {
          await dispose()
        } catch (error) {
          errors.push(error)
        }
      }
    }
    if (errors.length) {
      throw new AggregateError(
        errors,
        `Router cleanup failed for ${initialEntry}: ${errors.map(String).join("; ")}`
      )
    }
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

export function renderPage(
  component: () => React.ReactElement,
  onRequest?: (input: RequestInfo | URL) => void
) {
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      onRequest?.(input)
      if (pathOf(input) === "/api/public-config") {
        return Response.json({
          google: mockPublicConfig.google,
          coachDurable: false,
        })
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
  const rootRoute = createRootRoute()
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([pageRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })
  registerTestCleanup(async () => {
    await queryClient.cancelQueries()
    queryClient.clear()
    router.clearCache()
    router.history.destroy()
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
