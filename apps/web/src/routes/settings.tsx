import { useNavigate, useRouterState } from "@tanstack/react-router"

import { SettingsWorkspace } from "@/features/app-shell/settings-workspace.tsx"
import {
  SURFACE_PATHS,
  isSettingsTab,
  type SettingsTab,
} from "@/features/app-shell/surfaces.ts"

export function SettingsPage() {
  const search = useRouterState({
    select: (state) => state.location.search as Record<string, unknown>,
  })
  const navigate = useNavigate()
  const tab: SettingsTab = isSettingsTab(search.tab) ? search.tab : "general"

  return (
    <SettingsWorkspace
      tab={tab}
      onTabChange={(next) => {
        void navigate({
          to: SURFACE_PATHS.settings,
          search: next === "general" ? {} : { tab: next },
          replace: true,
        })
      }}
    />
  )
}
