export type SurfaceId = "home" | "paper" | "apply" | "pitch" | "settings"

export const SURFACES: { id: SurfaceId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "paper", label: "Paper" },
  { id: "apply", label: "Apply" },
  { id: "pitch", label: "Pitch" },
  { id: "settings", label: "Settings" },
]

export const SURFACE_PATHS = {
  home: "/app",
  paper: "/app/paper",
  apply: "/app/apply",
  pitch: "/app/pitch",
  settings: "/app/settings",
} as const satisfies Record<SurfaceId, string>

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
