export type SurfaceId =
  | "coach"
  | "jobs"
  | "inbox"
  | "proofs"
  | "paper"
  | "apply"
  | "pitch"
  | "settings"

export const SURFACE_PATHS = {
  coach: "/app/coach",
  jobs: "/app/jobs",
  inbox: "/app/inbox",
  proofs: "/app/proofs",
  paper: "/app/paper",
  apply: "/app/apply",
  pitch: "/app/pitch",
  settings: "/app/settings",
} as const satisfies Record<SurfaceId, string>

/** Left until #377 replaces Home. Not a shell surface. */
export const HOME_PATH = "/app/home"

export const SURFACE_COPY: Record<SurfaceId, { title: string; body: string }> =
  {
    coach: {
      title: "Coach",
      body: "Ask for the next step and keep the conversation beside your work.",
    },
    jobs: {
      title: "Jobs",
      body: "Roles you are tracking, with the company under the title.",
    },
    inbox: {
      title: "Inbox",
      body: "Mail about your search, in one list.",
    },
    proofs: {
      title: "Proofs",
      body: "Work samples you can attach to an application.",
    },
    paper: {
      title: "Paper",
      body: "CVs, letters, and proofs in one workspace.",
    },
    apply: {
      title: "Apply",
      body: "Jobs moving through saved, applied, interview, offer, and closed.",
    },
    pitch: {
      title: "Pitch",
      body: "A shareable portfolio for recruiters, at a copyable link.",
    },
    settings: {
      title: "Settings",
      body: "General preferences, Connected apps, and Account.",
    },
  }
