import { shellCopy } from "@/features/app-shell/shell-copy.ts"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"

export const SHELL_PRIMARY = [
  { id: "inbox", label: shellCopy.inbox, to: SURFACE_PATHS.inbox },
  { id: "coach", label: shellCopy.coach, to: SURFACE_PATHS.coach },
  { id: "jobs", label: shellCopy.jobs, to: SURFACE_PATHS.jobs },
] as const

export const SHELL_WORK = [
  { id: "paper", label: shellCopy.paper, to: SURFACE_PATHS.paper },
  { id: "apply", label: shellCopy.apply, to: SURFACE_PATHS.apply },
  { id: "pitch", label: shellCopy.pitch, to: SURFACE_PATHS.pitch },
] as const
