export const SETTINGS_SECTIONS = [
  { id: "preferences", label: "Preferences" },
  { id: "coach", label: "Coach" },
  { id: "integrations", label: "Integrations" },
  { id: "usage", label: "Usage & limits" },
  { id: "billing", label: "Billing" },
  { id: "account", label: "Account" },
] as const

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"]

export type SettingsView = SettingsSectionId | "upgrade"

const SECTION_IDS = new Set<string>(SETTINGS_SECTIONS.map((item) => item.id))

export function isSettingsSection(value: string): value is SettingsSectionId {
  return SECTION_IDS.has(value)
}

export function settingsViewFromPath(pathname: string): SettingsView {
  if (pathname.endsWith("/billing/upgrade") || pathname.endsWith("/upgrade")) {
    return "upgrade"
  }
  const tail = pathname.split("/").filter(Boolean).pop()
  if (tail && isSettingsSection(tail)) return tail
  return "preferences"
}

export function settingsSectionHref(id: SettingsSectionId) {
  return id === "preferences" ? "/app/settings" : `/app/settings/${id}`
}

export function validateSettingsSearch(search: Record<string, unknown>): {
  tab?: string
} {
  return typeof search.tab === "string" ? { tab: search.tab } : {}
}
