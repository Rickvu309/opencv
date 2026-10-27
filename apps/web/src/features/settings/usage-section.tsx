import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { Profile, QueryOutput } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import { UsageBar } from "@workspace/ui/components/usage-bar"

import {
  SettingsCard,
  SettingsLoadError,
  SettingsRow,
  SettingsSection,
  SettingsSkeletons,
  SettingsTitle,
} from "./settings-layout.tsx"
import {
  NO_SESSION_CAP,
  NO_WEEKLY_CAP,
  percentLabel,
  sessionResetLabel,
  weekResetLabel,
} from "./settings-api.ts"
import { fetchUsage, usageKey } from "@/lib/account-api.ts"

export function UsageSection({
  plan,
  timeZone,
}: {
  plan: Profile["plan"]
  timeZone: string
}) {
  const usage = useQuery({
    queryKey: usageKey(),
    queryFn: fetchUsage,
  })
  const navigate = useNavigate()
  const planLine =
    plan === "pro" ? "You're on the Pro plan." : "You're on the Free plan."

  if (usage.isPending) {
    return (
      <>
        <SettingsTitle title="Usage & limits">{planLine}</SettingsTitle>
        <SettingsSkeletons />
      </>
    )
  }
  if (usage.isError || !usage.data) {
    return <SettingsLoadError onRetry={() => void usage.refetch()} />
  }

  const snapshot = usage.data
  return (
    <>
      <SettingsTitle title="Usage & limits">{planLine}</SettingsTitle>
      <SettingsSection label="Coach usage">
        <SettingsCard>
          <UsageReadout
            label="Current session"
            kind="session"
            usageWindow={snapshot.session}
            timeZone={timeZone}
          />
          <UsageReadout
            label="This week"
            kind="week"
            usageWindow={snapshot.week}
            timeZone={timeZone}
          />
        </SettingsCard>
      </SettingsSection>
      <SettingsSection label="Need more?">
        <p className="text-sm text-muted-foreground">
          Pro gives you unlimited Coach chats.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void navigate({ href: "/app/settings/billing/upgrade" })
          }
        >
          Upgrade to Pro
        </Button>
      </SettingsSection>
    </>
  )
}

function UsageReadout({
  label,
  kind,
  usageWindow,
  timeZone,
}: {
  label: string
  kind: "session" | "week"
  usageWindow: QueryOutput<"coach.usage">["session"]
  timeZone: string
}) {
  const uncapped = kind === "week" ? NO_WEEKLY_CAP : NO_SESSION_CAP
  return (
    <SettingsRow
      label={label}
      desc={
        usageWindow.capped
          ? kind === "session"
            ? sessionResetLabel(usageWindow.resetsAt)
            : weekResetLabel(usageWindow.resetsAt, timeZone)
          : undefined
      }
      control={
        usageWindow.capped ? (
          <span className="flex flex-col items-end gap-1">
            <span>{percentLabel(usageWindow.percent)}</span>
            <UsageBar
              className="w-28"
              value={usageWindow.percent / 100}
              label={percentLabel(usageWindow.percent)}
            />
          </span>
        ) : (
          <span>{uncapped}</span>
        )
      }
    />
  )
}
