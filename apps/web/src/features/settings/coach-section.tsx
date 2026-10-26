import { useQuery } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { SegmentedControl } from "@workspace/ui/components/segmented-control"
import { UsageBar } from "@workspace/ui/components/usage-bar"

import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
  SettingsSkeletons,
  SettingsTitle,
  StateWord,
} from "./settings-layout.tsx"
import {
  NO_WEEKLY_CAP,
  readUsage,
  weekUsageLabel,
  type ProfilePatch,
  type SettingsProfile,
  type SettingsSave,
} from "./settings-api.ts"

const AGENTS = [
  {
    key: "agentChat",
    label: "Coach chat",
    desc: "Set your background and how Coach replies",
  },
  {
    key: "agentCvs",
    label: "Tailored CVs",
    desc: "Tailor your CV to each job in Apply",
  },
  {
    key: "agentInterview",
    label: "Interview prep",
    desc: "Practice questions from each job post",
  },
  {
    key: "agentEmail",
    label: "Email updates",
    desc: "Move jobs when a recruiter replies in Gmail",
  },
  {
    key: "agentWeekly",
    label: "Weekly plan",
    desc: "Every Monday, the jobs to apply for next",
  },
] as const

const MODES = [
  { value: "free", label: "Free" },
  { value: "light", label: "Light" },
  { value: "max", label: "Max" },
] as const

export function CoachSection({
  profile,
  pending,
  errorKey,
  error,
  onSave,
}: SettingsSave & { profile: SettingsProfile }) {
  const usage = useQuery({
    queryKey: ["settings", "usage"],
    queryFn: readUsage,
  })
  const week = usage.data?.week
  return (
    <>
      <SettingsTitle title="Coach">
        Your career coach across Paper and Apply.
      </SettingsTitle>
      <SettingsSection label="Usage">
        {usage.isPending ? (
          <SettingsSkeletons />
        ) : (
          <SettingsCard>
            <SettingsRow
              label={
                week && week.capped
                  ? weekUsageLabel(week.percent)
                  : NO_WEEKLY_CAP
              }
              control={
                week && week.capped ? (
                  <UsageBar
                    className="w-28"
                    value={week.percent / 100}
                    label={weekUsageLabel(week.percent)}
                  />
                ) : null
              }
            />
          </SettingsCard>
        )}
      </SettingsSection>
      <SettingsCard>
        <SettingsRow
          label="Enable memory"
          desc="Coach remembers past chats. Never used to train models."
          error={errorKey === "memoryEnabled" ? error : undefined}
          control={
            <Button
              type="button"
              variant="ghost"
              role="switch"
              aria-checked={profile.memoryEnabled}
              aria-label={`Enable memory, ${profile.memoryEnabled ? "Enabled" : "Disabled"}`}
              disabled={pending}
              onClick={() => onSave({ memoryEnabled: !profile.memoryEnabled })}
            >
              <StateWord on={profile.memoryEnabled} />
            </Button>
          }
        />
      </SettingsCard>
      <SettingsSection label="Coach agent">
        <p className="text-sm text-muted-foreground">
          Works for you inside Paper and Apply.
        </p>
        <SettingsCard>
          {AGENTS.map((agent) => (
            <SettingsRow
              key={agent.key}
              label={agent.label}
              desc={agent.desc}
              disabled={pending}
              error={errorKey === agent.key ? error : undefined}
              onClick={() =>
                onSave({ [agent.key]: !profile[agent.key] } as ProfilePatch)
              }
              control={<StateWord on={profile[agent.key]} />}
            />
          ))}
        </SettingsCard>
      </SettingsSection>
      <SettingsSection label="Coach mode">
        <SettingsCard>
          <SettingsRow
            label="Coach mode"
            desc="Free is included. Light and Max need Pro."
            error={errorKey === "coachMode" ? error : undefined}
            control={
              <SegmentedControl
                aria-label="Coach mode"
                size="sm"
                disabled={pending}
                value={profile.coachMode}
                onChange={(coachMode) => onSave({ coachMode })}
                options={MODES.map((mode) => ({ ...mode }))}
              />
            }
          />
        </SettingsCard>
      </SettingsSection>
    </>
  )
}
