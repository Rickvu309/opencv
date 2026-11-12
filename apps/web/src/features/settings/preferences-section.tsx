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
      <SettingsSection id="interface" label="Interface">
        <SettingsCard name="interface">
          <SettingsRow
            id="language"
            label="Language"
            desc="Menus and buttons stay in English for now"
            error={errorKey === "language" ? error : undefined}
            control={
              <SegmentedControl
                aria-label="Language"
                size="sm"
                className="pointer-fine:[--ui-segc-h:30px]! pointer-fine:[--ui-segc-px:10px]!"
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
            id="time-zone"
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
                  className="touch-manipulation gap-2 rounded-[7px] px-2.5 data-[size=default]:max-md:h-11 md:text-[13px]"
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
            id="start-page"
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
                  className="touch-manipulation gap-2 rounded-[7px] px-2.5 data-[size=default]:max-md:h-11 md:text-[13px]"
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
    </>
  )
}
