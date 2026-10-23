import type { ComponentProps } from "react"
import { AssistantRuntimeProvider } from "@assistant-ui/react"

import {
  useCoachExternalRuntime,
  type CoachRuntimeTurn,
} from "@/features/coach/coach-runtime.ts"
import { CoachThread } from "@/features/coach/coach-thread.tsx"

type Props = ComponentProps<typeof CoachThread> & { turn: CoachRuntimeTurn }

export function CoachThreadPanel({ turn, ...threadProps }: Props) {
  const runtime = useCoachExternalRuntime(turn)
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <CoachThread {...threadProps} />
    </AssistantRuntimeProvider>
  )
}
