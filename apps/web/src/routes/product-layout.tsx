import { useRouteContext } from "@tanstack/react-router"

import { AppShellLayout } from "@/features/app-shell/app-shell-layout.tsx"
import { SessionCheckNotice } from "@/features/auth/session-check-notice.tsx"

export function ProductLayout() {
  const context: { sessionCheck?: unknown } = useRouteContext({
    strict: false,
  })
  return (
    <>
      <SessionCheckNotice
        kind={context.sessionCheck === "unknown" ? "unknown" : "signed-in"}
      />
      <AppShellLayout />
    </>
  )
}
