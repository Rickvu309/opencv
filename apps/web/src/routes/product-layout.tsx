import { useRouteContext, useRouterState } from "@tanstack/react-router"

import { AppShellLayout } from "@/features/app-shell/app-shell-layout.tsx"
import { SessionCheckNotice } from "@/features/auth/session-check-notice.tsx"
import { SettingsNav } from "@/features/settings/settings-nav.tsx"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"

export function ProductLayout() {
  const context: { sessionCheck?: unknown } = useRouteContext({
    strict: false,
  })
  const inSettings = useRouterState({
    select: (state) =>
      state.location.pathname === SURFACE_PATHS.settings ||
      state.location.pathname.startsWith(`${SURFACE_PATHS.settings}/`),
  })
  return (
    <>
      <SessionCheckNotice
        kind={context.sessionCheck === "unknown" ? "unknown" : "signed-in"}
      />
      <AppShellLayout sidebar={inSettings ? <SettingsNav /> : undefined} />
    </>
  )
}
