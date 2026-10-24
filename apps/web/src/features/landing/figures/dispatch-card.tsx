import { useRef } from "react"

import { translateWorld } from "./camera.ts"
import { Chunks } from "./chunks.tsx"
import { back, carriage, near } from "./dispatch/geometry.ts"
import { FigureCard } from "./frame.tsx"
import { VIEW } from "./layout.ts"
import { DISPATCH_SPEC, dispatchPose } from "./model.ts"

export function DispatchCard() {
  const carriageRef = useRef<SVGGElement>(null)

  return (
    <FigureCard
      spec={DISPATCH_SPEC}
      readoutOf={(value) => dispatchPose(value).readout}
      apply={(value) => {
        const pose = dispatchPose(value)
        carriageRef.current?.setAttribute(
          "transform",
          translateWorld(pose.x, 0, 0)
        )
      }}
      titleId="landing-dispatch-title"
      heading="Ready for what’s next"
      description="Inbox, Prep, Sent, Live, Closed. You or the Coach move the card, and it stays on the board. Sent means you marked it sent."
    >
      <svg
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        role="img"
        aria-label="A five-bay rack. The card moves between Inbox, Prep, Sent, Live, and Closed and stays on the board."
        className="iso-svg pointer-events-none h-full w-full"
      >
        <Chunks parts={back} />
        <g ref={carriageRef}>
          <Chunks parts={carriage} />
        </g>
        <Chunks parts={near} />
      </svg>
    </FigureCard>
  )
}
