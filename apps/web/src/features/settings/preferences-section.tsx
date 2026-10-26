import { Mail, Monitor } from "lucide-react"
import { SegmentedControl } from "@workspace/ui/components/segmented-control"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
  SettingsTitle,
  StateWord,
} from "./settings-layout.tsx"
import type { ProfilePatch, SettingsProfile } from "./settings-api.ts"

const ZONES = [
  { value: "Asia/Ho_Chi_Minh", label: "Ho Chi Minh City (UTC+7)" },
  { value: "Asia/Singapore", label: "Singapore (UTC+8)" },
] as const

const START_PAGES = [
  { value: "apply", label: "Apply" },
  { value: "coach", label: "Coach" },
  { value: "paper", label: "Paper" },
  { value: "inbox", label: "Inbox" },
] as const

export function PreferencesSection({
  profile,
  pending,
  errorKey,
  error,
  onSave,
}: {
  profile: SettingsProfile
  pending: boolean
  errorKey?: string
  error?: string
  onSave: (patch: ProfilePatch) => void
}) {
  const zones = ZONES.some((zone) => zone.value === profile.timeZone)
    ? ZONES
    : [...ZONES, { value: profile.timeZone, label: profile.timeZone }]
  const zoneLabel =
    zones.find((zone) => zone.value === profile.timeZone)?.label ??
    profile.timeZone
  const startLabel =
    START_PAGES.find((page) => page.value === profile.startPage)?.label ??
    "Apply"
  return (
    <>
      <SettingsTitle title="Preferences" />
      <SettingsSection label="Interface">
        <SettingsCard>
          <SettingsRow
            label="Language"
            desc="Words in menus and buttons"
            error={errorKey === "language" ? error : undefined}
            control={
              <SegmentedControl
                aria-label="Language"
                size="sm"
                disabled={pending}
                value={profile.language}
                onChange={(language) => onSave({ language })}
                options={[
                  { value: "en", label: "English" },
                  { value: "vi", label: "Tiếng Việt" },
                ]}
              />
            }
          />
          <SettingsRow
            label="Time zone"
            desc="Used for interviews and deadlines"
            error={errorKey === "timeZone" ? error : undefined}
            control={
              <Select
                value={profile.timeZone}
                onValueChange={(timeZone) => {
                  if (timeZone) onSave({ timeZone })
                }}
              >
                <SelectTrigger aria-label="Time zone" disabled={pending}>
                  <SelectValue>{zoneLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {zones.map((zone) => (
                    <SelectItem key={zone.value} value={zone.value}>
                      {zone.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
          <SettingsRow
            label="Start page"
            desc="What opens when you sign in"
            error={errorKey === "startPage" ? error : undefined}
            control={
              <Select
                value={profile.startPage}
                onValueChange={(startPage) => {
                  if (
                    startPage === "apply" ||
                    startPage === "coach" ||
                    startPage === "paper" ||
                    startPage === "inbox"
                  ) {
                    onSave({ startPage })
                  }
                }}
              >
                <SelectTrigger aria-label="Start page" disabled={pending}>
                  <SelectValue>{startLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {START_PAGES.map((page) => (
                    <SelectItem key={page.value} value={page.value}>
                      {page.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        </SettingsCard>
      </SettingsSection>
      <SettingsSection label="Notifications">
        <SettingsCard>
          <SettingsRow
            label="Email"
            desc={profile.email}
            onClick={() => onSave({ notifyEmail: !profile.notifyEmail })}
            disabled={pending}
            error={errorKey === "notifyEmail" ? error : undefined}
            control={
              <span className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" aria-hidden />
                <StateWord on={profile.notifyEmail} />
              </span>
            }
          />
          <SettingsRow
            label="Browser"
            desc="While opencv is open"
            onClick={() => onSave({ notifyBrowser: !profile.notifyBrowser })}
            disabled={pending}
            error={errorKey === "notifyBrowser" ? error : undefined}
            control={
              <span className="flex items-center gap-2">
                <Monitor className="size-4 text-muted-foreground" aria-hidden />
                <StateWord on={profile.notifyBrowser} />
              </span>
            }
          />
        </SettingsCard>
      </SettingsSection>
    </>
  )
}
