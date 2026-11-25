import type { Profile, QueryOutput } from "@workspace/domain"
import { UsageBar } from "@workspace/ui/components/usage-bar"

import {
  SettingsCard,
  SettingsLoadError,
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
import { catalogClient } from "@/lib/contract-client.ts"
import { useOwnerId } from "@/lib/owner-id.ts"

export function UsageSection({
  plan,
  timeZone,
}: {
  plan: Profile["plan"]
  timeZone: string
}) {
  const usage = catalogClient.useRead(useOwnerId(), "coach.usage", {})
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
    return (
      <>
        <SettingsTitle title="Usage & limits">{planLine}</SettingsTitle>
        <SettingsLoadError onRetry={() => void usage.refetch()} />
      </>
    )
  }

  const snapshot = usage.data
  return (
    <>
      <SettingsTitle title="Usage & limits">{planLine}</SettingsTitle>
      <SettingsSection id="coach-usage" label="Coach usage" spacing="grid">
        <SettingsCard name="coach-usage">
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
  const desc = usageWindow.capped
    ? kind === "session"
      ? sessionResetLabel(usageWindow.resetsAt)
      : weekResetLabel(usageWindow.resetsAt, timeZone)
    : undefined
  return (
    <div
      data-slot="settings-row"
      data-row={kind}
      className="flex flex-wrap items-center gap-4 px-5 py-4"
    >
      <span
        data-slot="settings-usage-text"
        className="flex w-full min-w-0 flex-col gap-0.5 md:w-45"
      >
        <span data-slot="settings-row-label" className="text-ui font-medium">
          {label}
        </span>
        {desc ? (
          <span className="text-xs text-muted-foreground">{desc}</span>
        ) : null}
      </span>
      {usageWindow.capped ? (
        <>
          <UsageBar
            className="min-w-24 flex-1"
            value={usageWindow.percent / 100}
            label={percentLabel(usageWindow.percent)}
          />
          <span
            data-slot="settings-usage-percent"
            className="w-16 shrink-0 text-ui text-muted-foreground"
          >
            {percentLabel(usageWindow.percent)}
          </span>
        </>
      ) : (
        <span className="text-ui text-muted-foreground">{uncapped}</span>
      )}
    </div>
  )
}
