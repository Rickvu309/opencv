import type { ReactNode } from "react"

import "../landing-figures.css"

import type { AboutPrincipleId } from "./about-copy.ts"

const COS30 = Math.cos(Math.PI / 6)
const SIN30 = Math.sin(Math.PI / 6)

type Pt = readonly [number, number, number]

type Box = {
  x: number
  y: number
  z: number
  w: number
  d: number
  h: number
}

const MAT: Box = { x: 8, y: 6, z: 0, w: 74, d: 50, h: 2.2 }

function xy(x: number, y: number, z: number): [number, number] {
  return [(x - y) * COS30, (x + y) * SIN30 - z]
}

function path(points: readonly Pt[], close = true): string {
  const commands = points.map(([x, y, z], index) => {
    const [sx, sy] = xy(x, y, z)
    return `${index === 0 ? "M" : "L"}${sx.toFixed(2)} ${sy.toFixed(2)}`
  })
  return close ? `${commands.join("")}Z` : commands.join("")
}

function line(a: Pt, b: Pt): string {
  return path([a, b], false)
}

function arc(
  cx: number,
  cy: number,
  z: number,
  r: number,
  t0: number,
  t1: number,
  steps: number
): Pt[] {
  const points: Pt[] = []
  for (let index = 0; index <= steps; index += 1) {
    const t = t0 + ((t1 - t0) * index) / steps
    points.push([cx + r * Math.cos(t), cy + r * Math.sin(t), z])
  }
  return points
}

function boxEdges(box: Box): string {
  const { x, y, z, w, d, h } = box
  const segments: ReadonlyArray<readonly [Pt, Pt]> = [
    [
      [x, y, z + h],
      [x + w, y, z + h],
    ],
    [
      [x + w, y, z + h],
      [x + w, y + d, z + h],
    ],
    [
      [x + w, y + d, z + h],
      [x, y + d, z + h],
    ],
    [
      [x, y + d, z + h],
      [x, y, z + h],
    ],
    [
      [x + w, y, z],
      [x + w, y, z + h],
    ],
    [
      [x + w, y + d, z],
      [x + w, y + d, z + h],
    ],
    [
      [x, y + d, z],
      [x, y + d, z + h],
    ],
    [
      [x + w, y, z],
      [x + w, y + d, z],
    ],
    [
      [x + w, y + d, z],
      [x, y + d, z],
    ],
  ]
  return segments.map(([a, b]) => line(a, b)).join("")
}

function Solid({
  box,
  top,
  children,
}: {
  box: Box
  top: "paper" | "plinth"
  children?: ReactNode
}) {
  const { x, y, z, w, d, h } = box
  const left: Pt[] = [
    [x, y + d, z],
    [x + w, y + d, z],
    [x + w, y + d, z + h],
    [x, y + d, z + h],
  ]
  const right: Pt[] = [
    [x + w, y, z],
    [x + w, y + d, z],
    [x + w, y + d, z + h],
    [x + w, y, z + h],
  ]
  const lid: Pt[] = [
    [x, y, z + h],
    [x + w, y, z + h],
    [x + w, y + d, z + h],
    [x, y + d, z + h],
  ]
  return (
    <g className="iso-solid">
      <path className="iso-shade" data-shade="2" d={path(left)} />
      <path className="iso-shade" data-shade="0" d={path(right)} />
      {top === "paper" ? (
        <path className="iso-top" d={path(lid)} />
      ) : (
        <path className="iso-shade" data-shade="3" d={path(lid)} />
      )}
      {children}
      <path className="iso-line iso-edge" data-tone="lo" d={boxEdges(box)} />
    </g>
  )
}

function Ruled({ box, widths }: { box: Box; widths: readonly number[] }) {
  const { x, y, z, w, d, h } = box
  const top = z + h
  const x0 = x + w * 0.16
  const span = w * 0.68
  const y0 = y + d * 0.22
  const y1 = y + d * 0.78
  return widths.map((frac, index) => {
    const yy =
      widths.length === 1
        ? (y0 + y1) / 2
        : y0 + ((y1 - y0) * index) / (widths.length - 1)
    return (
      <path
        key={yy}
        className="iso-line"
        data-tone="mid"
        d={line([x0, yy, top], [x0 + span * frac, yy, top])}
      />
    )
  })
}

function Mark({
  x,
  y,
  z,
  w,
  d,
}: {
  x: number
  y: number
  z: number
  w: number
  d: number
}) {
  return (
    <path
      className="iso-shade"
      data-shade="1"
      d={path([
        [x, y, z],
        [x + w, y, z],
        [x + w, y + d, z],
        [x, y + d, z],
      ])}
    />
  )
}

function Puck({
  cx,
  cy,
  z,
  r,
  h,
}: {
  cx: number
  cy: number
  z: number
  r: number
  h: number
}) {
  const left = (3 * Math.PI) / 4
  const right = -Math.PI / 4
  const cap = arc(cx, cy, z + h, r, 0, Math.PI * 2, 24)
  const side = [
    ...arc(cx, cy, z, r, left, right, 14),
    ...arc(cx, cy, z + h, r, right, left, 14),
  ]
  const face = arc(cx, cy, z + h, r * 0.42, 0, Math.PI * 2, 16)
  return (
    <g className="iso-solid">
      <path className="iso-shade" data-shade="0" d={path(side)} />
      <path className="iso-top" d={path(cap)} />
      <path className="iso-shade" data-shade="1" d={path(face)} />
      <path className="iso-line iso-edge" data-tone="lo" d={path(cap)} />
    </g>
  )
}

function WorkScene() {
  const page: Box = { x: 16, y: 14, z: MAT.h, w: 48, d: 32, h: 1.6 }
  const chip: Box = { x: 46, y: 18, z: page.z + page.h, w: 14, d: 11, h: 5 }
  return (
    <>
      <Solid box={MAT} top="plinth" />
      <Solid box={page} top="paper">
        <Ruled box={page} widths={[0.96, 0.62, 0.84, 0.4]} />
      </Solid>
      <Solid box={chip} top="paper" />
    </>
  )
}

function CvScene() {
  const page: Box = { x: 12, y: 14, z: MAT.h, w: 34, d: 30, h: 1.6 }
  const job: Box = { x: 50, y: 18, z: MAT.h, w: 26, d: 24, h: 1.6 }
  return (
    <>
      <Solid box={MAT} top="plinth" />
      <Solid box={page} top="paper">
        <Ruled box={page} widths={[0.92, 0.7, 0.86, 0.5]} />
      </Solid>
      <Solid box={job} top="paper">
        <Mark x={54} y={22} z={job.z + job.h} w={8} d={7} />
        <Ruled box={job} widths={[0.7, 0.45]} />
      </Solid>
    </>
  )
}

function CoachScene() {
  const base: Box = { x: 16, y: 22, z: MAT.h, w: 18, d: 14, h: 1.6 }
  const neck: Box = { x: 20, y: 25, z: base.z + base.h, w: 8, d: 8, h: 4 }
  const screen: Box = {
    x: 21.2,
    y: 12,
    z: neck.z + neck.h,
    w: 3.4,
    d: 28,
    h: 20,
  }
  const letter: Box = { x: 40, y: 34, z: MAT.h, w: 30, d: 16, h: 1.5 }
  const faceX = screen.x + screen.w
  const glass: Pt[] = [
    [faceX, screen.y + 2.2, screen.z + 2],
    [faceX, screen.y + screen.d - 2.2, screen.z + 2],
    [faceX, screen.y + screen.d - 2.2, screen.z + screen.h - 2],
    [faceX, screen.y + 2.2, screen.z + screen.h - 2],
  ]
  const steps = [
    { offset: 14, len: 16 },
    { offset: 9, len: 11 },
    { offset: 4.2, len: 14 },
  ]
  return (
    <>
      <Solid box={MAT} top="plinth" />
      <Solid box={base} top="plinth" />
      <Solid box={neck} top="plinth" />
      <Solid box={screen} top="paper">
        <path className="iso-top" d={path(glass)} />
        {steps.map((step) => {
          const z = screen.z + step.offset
          const y = screen.y + 5
          return (
            <g key={step.offset}>
              <path
                className="iso-shade"
                data-shade="0"
                d={path([
                  [faceX, y, z],
                  [faceX, y + 1.6, z],
                  [faceX, y + 1.6, z + 1.6],
                  [faceX, y, z + 1.6],
                ])}
              />
              <path
                className="iso-line"
                data-tone="mid"
                d={line(
                  [faceX, y + 3, z + 0.8],
                  [faceX, y + 3 + step.len, z + 0.8]
                )}
              />
            </g>
          )
        })}
      </Solid>
      <Puck cx={66} cy={18} z={MAT.h} r={5.5} h={4.2} />
      <Solid box={letter} top="paper">
        <Ruled box={letter} widths={[0.84, 0.55]} />
      </Solid>
    </>
  )
}

function DataScene() {
  const box: Box = { x: 22, y: 14, z: MAT.h, w: 42, d: 28, h: 20 }
  const post: Box = { x: 32, y: 24, z: box.z + box.h, w: 3.2, d: 3.2, h: 5.5 }
  const postB: Box = {
    x: 50,
    y: 24,
    z: box.z + box.h,
    w: 3.2,
    d: 3.2,
    h: 5.5,
  }
  const handle: Box = {
    x: 32,
    y: 24.4,
    z: post.z + 3,
    w: 21.2,
    d: 2.4,
    h: 2.6,
  }
  const clasp: Box = {
    x: box.x + box.w,
    y: 25,
    z: box.z + 8,
    w: 2.2,
    d: 6,
    h: 4,
  }
  const seam = box.z + 16
  return (
    <>
      <Solid box={MAT} top="plinth" />
      <Solid box={box} top="paper">
        <path
          className="iso-line"
          data-tone="mid"
          d={line(
            [box.x + box.w, box.y, seam],
            [box.x + box.w, box.y + box.d, seam]
          )}
        />
        <path
          className="iso-line"
          data-tone="mid"
          d={line(
            [box.x + box.w, box.y + box.d, seam],
            [box.x, box.y + box.d, seam]
          )}
        />
      </Solid>
      <Solid box={clasp} top="plinth" />
      <Solid box={post} top="plinth" />
      <Solid box={postB} top="plinth" />
      <Solid box={handle} top="paper" />
    </>
  )
}

const SCENES: Record<AboutPrincipleId, () => ReactNode> = {
  work: WorkScene,
  cv: CvScene,
  coach: CoachScene,
  data: DataScene,
}

export function AboutFigure({
  id,
  label,
}: {
  id: AboutPrincipleId
  label: string
}) {
  const Scene = SCENES[id]
  return (
    <div className="about-figure landing-figures">
      <svg
        viewBox="-50 -20 124 100"
        role="img"
        aria-label={label}
        className="iso-svg"
      >
        <Scene />
      </svg>
    </div>
  )
}
