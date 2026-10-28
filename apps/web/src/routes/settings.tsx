import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import type { ProfileUpdateInput } from "@workspace/domain"

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
  TIME_ZONE_REJECTION,
} from "@/features/settings/settings-api.ts"
import { UpgradeScreen } from "@/features/settings/upgrade-screen.tsx"
import { UsageSection } from "@/features/settings/usage-section.tsx"
import { fetchProfile, profileKey } from "@/lib/account-api.ts"
import { useRunCommand } from "@/lib/contract-client.ts"
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
    queryKey: profileKey(),
    queryFn: fetchProfile,
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
  const runCommand = useRunCommand()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [errorKey, setErrorKey] = useState<string>()
  const [error, setError] = useState<string>()

  async function onSave(patch: ProfileUpdateInput) {
    const key = Object.keys(patch)[0]
    setPending(true)
    setError(undefined)
    setErrorKey(undefined)
    try {
      await runCommand("profile.update", patch)
    } catch (caught) {
      if (isPlanRequired(caught)) {
        await navigate({ href: "/settings/billing/upgrade" })
        return
      }
      setErrorKey(key)
      setError(
        key === "timeZone"
          ? TIME_ZONE_REJECTION
          : caught instanceof Error && caught.message.trim()
            ? caught.message
            : "Try again."
      )
    } finally {
      setPending(false)
    }
  }

  return { pending, errorKey, error, onSave }
}
