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
import {
  startPageSchema,
  type Profile,
  type ProfileUpdateInput,
} from "@workspace/domain"

import { START_PAGES, startPageEntry } from "@/lib/product-paths.ts"

const ZONES = [
  { value: "Asia/Ho_Chi_Minh", label: "Ho Chi Minh City (UTC+7)" },
  { value: "Asia/Singapore", label: "Singapore (UTC+8)" },
] as const

export function PreferencesSection({
  profile,
  pending,
  errorKey,
  error,
  onSave,
}: {
  profile: Profile
  pending: boolean
  errorKey?: string
  error?: string
  onSave: (patch: ProfileUpdateInput) => void
}) {
  const zones = ZONES.some((zone) => zone.value === profile.timeZone)
    ? ZONES
    : [...ZONES, { value: profile.timeZone, label: profile.timeZone }]
  const zoneLabel =
    zones.find((zone) => zone.value === profile.timeZone)?.label ??
    profile.timeZone
  const startLabel = startPageEntry(profile.startPage).label
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
                <SelectTrigger
                  aria-label="Time zone"
                  disabled={pending}
                  className="touch-manipulation data-[size=default]:max-md:h-11"
                >
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
                onValueChange={(value) => {
                  const startPage = startPageSchema.safeParse(value)
                  if (startPage.success) onSave({ startPage: startPage.data })
                }}
              >
                <SelectTrigger
                  aria-label="Start page"
                  disabled={pending}
                  className="touch-manipulation data-[size=default]:max-md:h-11"
                >
                  <SelectValue>{startLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(START_PAGES).map(([value, page]) => (
                    <SelectItem key={value} value={value}>
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
