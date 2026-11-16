import { Bar } from "@workspace/stageshow/kit/window.tsx"
import { Card } from "@workspace/stageshow/kit/parts/Card.tsx"
import { Count } from "@workspace/stageshow/kit/motion/Count.tsx"
import { Roll } from "@workspace/stageshow/kit/motion/Roll.tsx"
import { Slot } from "@workspace/stageshow/kit/controls/Slot.tsx"
import { Stage } from "@workspace/stageshow/kit/stage.tsx"
import type { Act } from "@workspace/stageshow/kit/act-api.ts"

import "./apply-board-scene.css"
import "./phone-scene.css"

type Placement =
  | { kind: "applied" }
  | { kind: "held"; x: number; y: number; settled: boolean }
  | { kind: "interview" }
type Scene = {
  placement: Placement
  scheduled: boolean
  advanced: boolean
}

const initial: Scene = {
  placement: { kind: "applied" },
  scheduled: false,
  advanced: false,
}
const poster: Scene = {
  placement: { kind: "interview" },
  scheduled: true,
  advanced: false,
}
const grip = { x: 0.84, y: 0.8 }
const cardHeight = 104

async function script(a: Act<Scene>) {
  a.mark("opening")
  await a.wait(1000)
  await a.move({ at: "job", ...grip }, { duration: 1100 })
  await a.wait(250)
  a.mark("pickup")
  const card = a.rect("job")
  const source = a.rect("applied-list")
  const destination = a.rect("interview-list")
  const grab = { x: card.width * grip.x, y: card.height * grip.y }
  const landing = { x: destination.x - source.x, y: destination.y - source.y }
  let marked = false
  await a.drag(
    { x: card.x + landing.x + grab.x, y: card.y + landing.y + grab.y },
    (at) => {
      a.put({
        placement: {
          kind: "held",
          x: at.x - grab.x - card.x,
          y: at.y - grab.y - card.y,
          settled: false,
        },
      })
      if (!marked && at.x > card.x + grab.x + card.width * 0.45) {
        a.mark("carried")
        marked = true
      }
    },
    { duration: 2400 }
  )
  await a.set({
    placement: { kind: "held", ...landing, settled: true },
    scheduled: true,
  })
  a.mark("drop")
  await a.move("rest", { duration: 700 })
  await a.wait(500)
  await a.set({ placement: { kind: "interview" } })
  a.mark("payoff")
  await a.wait(2500)
  a.mark("conveyor")
  await a.set({ advanced: true })
  await a.wait(850)
  await a.snap(initial)
  a.mark("reset")
  await a.wait(750)
}

function JobCard({
  placement,
  scheduled,
  active,
}: {
  placement: Placement
  scheduled: boolean
  active: boolean
}) {
  const held = placement.kind === "held"
  return (
    <div
      className="ocvh-focal"
      data-moved={placement.kind === "interview" || undefined}
      data-lifted={(held && !placement.settled) || undefined}
      style={
        held
          ? { transform: `translate(${placement.x}px, ${placement.y}px)` }
          : undefined
      }
    >
      <Card
        pad="small"
        gap={10}
        className="ocvh-job"
        data-target={active ? "job" : undefined}
        data-cursor="open"
      >
        <div className="ocvh-identity">
          <div className="ocvh-title">Junior Marketing</div>
          <div className="ocvh-company">Lumière Cosmetics</div>
        </div>
        <div className="ocvh-event" data-scheduled={scheduled || undefined}>
          <Roll>{scheduled ? "Interview" : "Applied"}</Roll>
          <Roll>{scheduled ? "Thu, 10:00" : "Oct 21"}</Roll>
        </div>
      </Card>
    </div>
  )
}

function FillerCard({ index }: { index: number }) {
  const widths = [80, 64, 88, 72]
  const width = widths[index % widths.length] ?? 72
  return (
    <Card pad="small" gap={8} className="ocvh-filler">
      <Bar w={`${width}%`} h={7} tone={3} />
      <Bar w={`${width - 16}%`} h={5} tone={2} />
      <Bar w={32} h={5} tone={2} />
    </Card>
  )
}

function Board({ scene, active = false }: { scene: Scene; active?: boolean }) {
  const { placement, scheduled } = scene
  const carrying = placement.kind === "held"
  return (
    <Card className="ocvh-board" pad="small" gap={0} data-crop>
      <div className="ocvh-columns">
        <div className="ocvh-column">
          <div className="ocvh-column-head">
            <span>Applied</span>
            <Count value={scheduled ? 4 : 5} className="ocvh-count" />
          </div>
          <div
            className="ocvh-list"
            data-target={active ? "applied-list" : undefined}
          >
            <Slot
              open={placement.kind === "applied"}
              height={cardHeight}
              gap={10}
            />
            <JobCard
              placement={placement}
              scheduled={scheduled}
              active={active}
            />
            {[0, 1, 2, 3].map((index) => (
              <FillerCard key={index} index={index} />
            ))}
          </div>
        </div>
        <div className="ocvh-column">
          <div className="ocvh-column-head">
            <span>Interview</span>
            <Count value={scheduled ? 5 : 4} className="ocvh-count" />
          </div>
          <div
            className="ocvh-list"
            data-target={active ? "interview-list" : undefined}
          >
            <Slot
              open={carrying || placement.kind === "interview"}
              height={cardHeight}
              gap={10}
              dashed={carrying && !placement.settled}
            />
            {[1, 2, 3, 0].map((index) => (
              <FillerCard key={index} index={index} />
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

export function ApplyBoardScene() {
  return (
    <Stage
      width={348}
      height={400}
      initial={initial}
      poster={poster}
      script={script}
      play="loop"
      fidelity="standard"
      cursor={{ at: "rest", style: "real", still: false }}
      className="look-opencv ocvh"
    >
      {(s) => (
        <>
          <div className="ocvh-track" data-advanced={s.advanced || undefined}>
            <Board scene={s} active />
            <Board scene={initial} />
          </div>
          <span className="ocvh-rest" data-target="rest" />
        </>
      )}
    </Stage>
  )
}
