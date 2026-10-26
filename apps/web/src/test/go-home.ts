import { act } from "@testing-library/react"
import type { AnyRouter } from "@tanstack/react-router"

import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"

let router: Pick<AnyRouter, "navigate"> | null = null

export function bindTestRouter(next: Pick<AnyRouter, "navigate">) {
  router = next
}

export async function goHome() {
  if (!router) throw new Error("renderApp did not bind a router")
  await act(async () => {
    await router?.navigate({ to: SURFACE_PATHS.home })
  })
}
