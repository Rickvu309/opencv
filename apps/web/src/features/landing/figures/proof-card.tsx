import { useRef } from "react"

import { translateWorld } from "./camera.ts"
import { Chunks } from "./chunks.tsx"
import { FigureCard } from "./frame.tsx"
import { PROOF_PIN_DROP, PROOF_PLATEN_DROP, VIEW } from "./layout.ts"
import { PROOF_SPEC, proofPose } from "./model.ts"
import {
  back,
  cover,
  near,
  pin_0,
  pin_1,
  pin_2,
  platen,
} from "./proof/geometry.ts"

export function ProofCard() {
  const platenRef = useRef<SVGGElement>(null)
  const contextRef = useRef<SVGGElement>(null)
  const actionRef = useRef<SVGGElement>(null)
  const outcomeRef = useRef<SVGGElement>(null)

  return (
    <FigureCard
      spec={PROOF_SPEC}
      readoutOf={(value) => proofPose(value).readout}
      apply={(value) => {
        const pose = proofPose(value)
        platenRef.current?.setAttribute(
          "transform",
          translateWorld(0, 0, -pose.platen * PROOF_PLATEN_DROP)
        )
        contextRef.current?.setAttribute(
          "transform",
          translateWorld(0, 0, -pose.pins[0] * PROOF_PIN_DROP)
        )
        actionRef.current?.setAttribute(
          "transform",
          translateWorld(0, 0, -pose.pins[1] * PROOF_PIN_DROP)
        )
        outcomeRef.current?.setAttribute(
          "transform",
          translateWorld(0, 0, -pose.pins[2] * PROOF_PIN_DROP)
        )
      }}
      titleId="landing-proof-title"
      heading="Proof, not claims"
      description="Context, what you did, and the outcome. The stamp falls only when those three are seated. The CV can cite the Proof, and Pitch can show it."
    >
      <svg
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        role="img"
        aria-label="A stamp press that stamps a Proof only when context, action, and outcome are seated."
        className="iso-svg pointer-events-none h-full w-full"
      >
        <Chunks parts={back} />
        <g ref={platenRef}>
          <Chunks parts={platen} />
        </g>
        <Chunks parts={cover} />
        <g ref={contextRef}>
          <Chunks parts={pin_0} />
        </g>
        <g ref={actionRef}>
          <Chunks parts={pin_1} />
        </g>
        <g ref={outcomeRef}>
          <Chunks parts={pin_2} />
        </g>
        <Chunks parts={near} />
      </svg>
    </FigureCard>
  )
}
