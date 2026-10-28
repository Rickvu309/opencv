import { useEffect, useState } from "react"
import { ThinkingLoader } from "@workspace/ui/components/thinking-loader"

export function CoachWorking() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const startedAt = Date.now()
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      1000
    )
    return () => clearInterval(timer)
  }, [])
  return <ThinkingLoader phases={[`Working, ${seconds}s`]} />
}
