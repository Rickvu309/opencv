import { useEffect, useReducer } from "react"
import { ThinkingLoader } from "@workspace/ui/components/thinking-loader"

function elapsedReducer(
  _seconds: number,
  action: { type: "ticked"; seconds: number }
) {
  return action.seconds
}

export function CoachWorking() {
  const [seconds, dispatch] = useReducer(elapsedReducer, 0)
  useEffect(() => {
    const startedAt = Date.now()
    const timer = setInterval(
      () =>
        dispatch({
          type: "ticked",
          seconds: Math.floor((Date.now() - startedAt) / 1000),
        }),
      1000
    )
    return () => clearInterval(timer)
  }, [])
  return <ThinkingLoader phases={[`Working, ${seconds}s`]} />
}
