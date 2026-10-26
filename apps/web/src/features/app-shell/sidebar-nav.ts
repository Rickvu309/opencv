import { shellCopy } from "@/features/app-shell/shell-copy.ts"

export const SHELL_PRIMARY = [
  { id: "inbox", label: shellCopy.inbox, to: "/app/inbox" },
  { id: "coach", label: shellCopy.coach, to: "/app/coach" },
  { id: "jobs", label: shellCopy.jobs, to: "/app/jobs" },
] as const

export const SHELL_WORK = [
  { id: "paper", label: shellCopy.paper, to: "/app/paper" },
  { id: "apply", label: shellCopy.apply, to: "/app/apply" },
  { id: "pitch", label: shellCopy.pitch, to: "/app/pitch" },
] as const
