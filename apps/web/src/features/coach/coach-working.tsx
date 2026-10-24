import { ThinkingLoader } from "@workspace/ui/components/thinking-loader"

const PHASES = ["Thinking"]

export function CoachWorking() {
  return <ThinkingLoader phases={PHASES} />
}
