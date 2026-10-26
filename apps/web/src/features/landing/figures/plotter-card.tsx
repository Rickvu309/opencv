import { useRef } from "react"

import { translateWorld } from "./camera.ts"
import { Chunks } from "./chunks.tsx"
import { FigureCard } from "./frame.tsx"
import { VIEW } from "./layout.ts"
import { PLOTTER_SPEC, plotterPose } from "./model.ts"
import { back, carriage, near } from "./plotter/geometry.ts"

type TraceName = "user" | "coach" | "letter"

export function PlotterCard() {
  const svgRef = useRef<SVGSVGElement>(null)
  const carriageRef = useRef<SVGGElement>(null)
  const traces = useRef<Record<TraceName, SVGElement[]> | null>(null)

  return (
    <FigureCard
      spec={PLOTTER_SPEC}
      readoutOf={(value) => plotterPose(value).readout}
      apply={(value) => {
        const pose = plotterPose(value)
        carriageRef.current?.setAttribute(
          "transform",
          translateWorld(pose.x, pose.y, pose.z)
        )
        const root = svgRef.current
        if (!root) return
        if (!traces.current) {
          const collect = (name: TraceName) =>
            [...root.querySelectorAll(`[data-trace="${name}"]`)].filter(
              (node): node is SVGElement => node instanceof SVGElement
            )
          traces.current = {
            user: collect("user"),
            coach: collect("coach"),
            letter: collect("letter"),
          }
        }
        const opacity: Record<TraceName, number> = {
          user: pose.user,
          coach: pose.coach,
          letter: pose.letter,
        }
        for (const name of ["user", "coach", "letter"] as const) {
          const next = String(opacity[name])
          for (const node of traces.current[name]) node.style.opacity = next
        }
      }}
      titleId="landing-plotter-title"
      heading="Written for you"
      description="Paste a job post and get a CV and letter that lead with your best work."
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        role="img"
        aria-label="A plotter whose pen moves between your CV line, the coach draft, and the Letter."
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
