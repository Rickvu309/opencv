import { useReducer } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouterState } from "@tanstack/react-router"
import type { ProfileUpdateInput } from "@workspace/domain/account"

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
import { UsageSection } from "@/features/settings/usage-section.tsx"
import { profileQuery } from "@/lib/account-api.ts"
import { useOwnerId } from "@/lib/owner-id.ts"
import { catalogClient } from "@/lib/contract-client.ts"

export function SettingsPage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const view = settingsViewFromPath(pathname)
  const profile = useQuery(profileQuery(useOwnerId()))
  const save = useSettingsSave()

  return (
    <SettingsLayout view={view} startPage={profile.data?.startPage}>
      {profile.isPending ? (
        <SettingsSkeletons />
      ) : profile.isError || !profile.data ? (
        <SettingsLoadError onRetry={() => void profile.refetch()} />
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

type SaveState = { pending: boolean; errorKey?: string; error?: string }
type SaveAction =
  | { type: "save_started" }
  | { type: "save_rejected"; key: string; message: string }
  | { type: "save_settled" }

function saveReducer(state: SaveState, action: SaveAction): SaveState {
  switch (action.type) {
    case "save_started":
      return { pending: true }
    case "save_rejected":
      return { ...state, errorKey: action.key, error: action.message }
    case "save_settled":
      return { ...state, pending: false }
  }
}

function useSettingsSave() {
  const queryClient = useQueryClient()
  const [{ pending, errorKey, error }, dispatch] = useReducer(saveReducer, {
    pending: false,
  })

  async function onSave(patch: ProfileUpdateInput) {
    const key = Object.keys(patch)[0]
    dispatch({ type: "save_started" })
    try {
      await catalogClient.run(queryClient, "profile.update", patch)
    } catch (caught) {
      if (isPlanRequired(caught)) {
        dispatch({
          type: "save_rejected",
          key,
          message: "Pro plan required.",
        })
        return
      }
      dispatch({
        type: "save_rejected",
        key,
        message:
          key === "timeZone"
            ? TIME_ZONE_REJECTION
            : caught instanceof Error && caught.message.trim()
              ? caught.message
              : "Try again.",
      })
    } finally {
      dispatch({ type: "save_settled" })
    }
  }

  return { pending, errorKey, error, onSave }
}
