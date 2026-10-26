export type SurfaceId = "home" | "paper" | "apply" | "pitch" | "settings"

export const SURFACE_PATHS = {
  home: "/app/home",
  paper: "/app/paper",
  apply: "/app/apply",
  pitch: "/app/pitch",
  settings: "/app/settings",
} as const satisfies Record<SurfaceId, string>

const SETTINGS_TABS = ["general", "apps", "account"] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]

export const SETTINGS_TAB_ITEMS: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "apps", label: "Connected apps" },
  { id: "account", label: "Account" },
]

export function isSettingsTab(value: unknown): value is SettingsTab {
  return SETTINGS_TABS.some((tab) => tab === value)
}

export function validateSettingsSearch(search: Record<string, unknown>): {
  tab?: SettingsTab
} {
  return isSettingsTab(search.tab) ? { tab: search.tab } : {}
}

export const SURFACE_COPY: Record<SurfaceId, { title: string; body: string }> =
  {
    home: {
      title: "Home",
      body: "The Coach lives here — a place to get direction and the next concrete step.",
    },
    paper: {
      title: "Paper",
      body: "CVs, Letters, and Proofs — the User's application documents, kept in one workspace.",
    },
    apply: {
      title: "Apply",
      body: "Tracking pursuit of an Opportunity across Stages, with Fit and the next Track.",
    },
    pitch: {
      title: "Pitch",
      body: "A shareable portfolio for recruiters, published at a copyable link.",
    },
    settings: {
      title: "Settings",
      body: "General preferences, Connected apps, and Account.",
    },
  }
