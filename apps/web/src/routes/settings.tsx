import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useRouterState } from "@tanstack/react-router"

import { AccountSection } from "@/features/settings/account-section.tsx"
import { BillingSection } from "@/features/settings/billing-section.tsx"
import { CoachSection } from "@/features/settings/coach-section.tsx"
import { IntegrationsSection } from "@/features/settings/integrations-section.tsx"
import { PreferencesSection } from "@/features/settings/preferences-section.tsx"
import { settingsViewFromPath } from "@/features/settings/sections.ts"
import {
  SettingsLayout,
  SettingsLoadError,
  SettingsSkeletons,
} from "@/features/settings/settings-layout.tsx"
import {
  isPlanRequired,
  readProfile,
  updateProfile,
  type ProfilePatch,
  type SettingsProfile,
} from "@/features/settings/settings-api.ts"
import { UpgradeScreen } from "@/features/settings/upgrade-screen.tsx"
import { UsageSection } from "@/features/settings/usage-section.tsx"
import { useFirstCafeSurfaceVisit } from "@/features/home/use-first-cafe-surface-visit.ts"

export function SettingsPage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const search = useRouterState({
    select: (state) => state.location.search as { tab?: string },
  })
  const view = settingsViewFromPath(pathname)
  useFirstCafeSurfaceVisit(search.tab === "apps" ? "email" : null)
  const profile = useQuery({
    queryKey: ["settings", "profile"],
    queryFn: readProfile,
  })
  const save = useSettingsSave()

  return (
    <SettingsLayout
      view={view}
      startPage={profile.data?.startPage}
      name={profile.data?.name}
    >
      {profile.isPending ? (
        <SettingsSkeletons />
      ) : profile.isError || !profile.data ? (
        <SettingsLoadError onRetry={() => void profile.refetch()} />
      ) : view === "upgrade" ? (
        <UpgradeScreen />
      ) : view === "preferences" ? (
        <PreferencesSection profile={profile.data} {...save} />
      ) : view === "coach" ? (
        <CoachSection profile={profile.data} {...save} />
      ) : view === "integrations" ? (
        <IntegrationsSection />
      ) : view === "usage" ? (
        <UsageSection
          plan={profile.data.plan}
          timeZone={profile.data.timeZone}
        />
      ) : view === "billing" ? (
        <BillingSection />
      ) : (
        <AccountSection profile={profile.data} {...save} />
      )}
    </SettingsLayout>
  )
}

function useSettingsSave() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [errorKey, setErrorKey] = useState<string>()
  const [error, setError] = useState<string>()

  async function onSave(patch: ProfilePatch) {
    const key = Object.keys(patch)[0]
    setPending(true)
    setError(undefined)
    setErrorKey(undefined)
    try {
      const next = await updateProfile(patch)
      queryClient.setQueryData<SettingsProfile>(["settings", "profile"], next)
    } catch (caught) {
      if (isPlanRequired(caught)) {
        await navigate({ href: "/app/settings/billing/upgrade" })
        return
      }
      setErrorKey(key)
      setError(caught instanceof Error ? caught.message : "Try again.")
    } finally {
      setPending(false)
    }
  }

  return { pending, errorKey, error, onSave }
}
