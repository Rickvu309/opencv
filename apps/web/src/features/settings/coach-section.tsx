import { useQuery } from "@tanstack/react-query"
import type { Profile, ProfileUpdateInput } from "@workspace/domain"
import { FileText, Mail, MessageCircle, Mic } from "lucide-react"
import { Switch } from "@workspace/ui/components/switch"

import {
  SettingsCard,
  SettingsRow,
  SettingsTile,
  SettingsTitle,
  SettingsUsageLink,
} from "./settings-layout.tsx"
import {
  NO_WEEKLY_CAP,
  weekUsageLabel,
  type SettingsSave,
} from "./settings-api.ts"
import { fetchUsage, usageKey } from "@/lib/account-api.ts"

const AGENTS = [
  {
    key: "agentChat",
    icon: MessageCircle,
    label: "Coach chat",
    desc: "Chat with Coach on its page and in the side panel",
  },
  {
    key: "agentCvs",
    icon: FileText,
    label: "Tailored CVs",
    desc: "Tailor your CV to each job in Apply",
  },
  {
    key: "agentInterview",
    icon: Mic,
    label: "Interview prep",
    desc: "Practice questions from each job post",
  },
  {
    key: "agentEmail",
    icon: Mail,
    label: "Email updates",
    desc: "Move jobs when a recruiter replies in Gmail",
  },
] as const

export function CoachSection({
  profile,
  pending,
  errorKey,
  error,
  onSave,
}: SettingsSave & { profile: Profile }) {
  const usage = useQuery({
    queryKey: usageKey(),
    queryFn: fetchUsage,
  })
  const week = usage.data?.week
  return (
    <>
      <SettingsTitle title="Coach">
        Your career coach across Paper and Apply.
      </SettingsTitle>
      <SettingsUsageLink
        desc={
          usage.isPending
            ? "Loading usage"
            : usage.isError
              ? "See your Coach limits"
              : week && week.capped
                ? weekUsageLabel(week.percent)
                : NO_WEEKLY_CAP
        }
      />
      <SettingsCard name="memory" className="mt-3">
        <SettingsRow
          id="memory"
          inset="wide"
          label="Enable memory"
          desc="Coach remembers past chats. Never used to train models."
          error={errorKey === "memoryEnabled" ? error : undefined}
          control={
            <Switch
              data-slot="settings-switch"
              aria-label={`Enable memory, ${profile.memoryEnabled ? "Enabled" : "Disabled"}`}
              aria-invalid={
                errorKey === "memoryEnabled" && error ? true : undefined
              }
              aria-describedby={
                errorKey === "memoryEnabled" && error
                  ? "settings-row-memory-error"
                  : undefined
              }
              checked={profile.memoryEnabled}
              disabled={pending}
              onCheckedChange={(memoryEnabled) => onSave({ memoryEnabled })}
            />
          }
        />
      </SettingsCard>
      <section
        data-slot="settings-agent-group"
        aria-labelledby="settings-coach-agent"
        className="mt-11 flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <h2
            id="settings-coach-agent"
            data-slot="settings-group-title"
            className="text-[15px] font-medium"
          >
            Coach agent
          </h2>
          <p className="text-ui text-muted-foreground">
            Works for you inside Paper and Apply.
          </p>
        </div>
        <SettingsCard name="capabilities">
          {AGENTS.map((agent) => (
            <SettingsRow
              key={agent.key}
              id={agent.key}
              inset="wide"
              label={agent.label}
              desc={agent.desc}
              error={errorKey === agent.key ? error : undefined}
              leading={<SettingsTile icon={agent.icon} />}
              control={
                <Switch
                  data-slot="settings-switch"
                  aria-label={`${agent.label}, ${profile[agent.key] ? "Enabled" : "Disabled"}`}
                  aria-invalid={
                    errorKey === agent.key && error ? true : undefined
                  }
                  aria-describedby={
                    errorKey === agent.key && error
                      ? `settings-row-${agent.key}-error`
                      : undefined
                  }
                  checked={profile[agent.key]}
                  disabled={pending}
                  onCheckedChange={(on) =>
                    onSave({ [agent.key]: on } as ProfileUpdateInput)
                  }
                />
              }
            />
          ))}
        </SettingsCard>
      </section>
    </>
  )
}
