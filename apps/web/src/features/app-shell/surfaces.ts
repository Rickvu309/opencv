import { SURFACE_PATHS } from "@/lib/product-paths.ts"

export type SurfaceId = keyof typeof SURFACE_PATHS

export { SURFACE_PATHS }

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
