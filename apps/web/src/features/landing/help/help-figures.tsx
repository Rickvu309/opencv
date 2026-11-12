import type { HelpTopicId } from "./help-copy.ts"

type Vec = readonly [number, number, number]

type Box = {
  at: Vec
  size: Vec
  tone?: "accent"
}

type Scene = {
  boxesBackToFront: readonly Box[]
}

const OX = 64
const OY = 52
const UNIT = 13
const COS = Math.cos(Math.PI / 6)

function point(x: number, y: number, z: number) {
  const sx = OX + (x - y) * COS * UNIT
  const sy = OY + (x + y) * 0.5 * UNIT - z * UNIT
  return `${Math.round(sx * 10) / 10},${Math.round(sy * 10) / 10}`
}

function polygon(pts: readonly Vec[]) {
  return pts.map(([x, y, z]) => point(x, y, z)).join(" ")
}

function BoxShape({ box }: { box: Box }) {
  const [x, y, z] = box.at
  const [w, d, h] = box.size
  const left: Vec[] = [
    [x, y + d, z],
    [x + w, y + d, z],
    [x + w, y + d, z + h],
    [x, y + d, z + h],
  ]
  const right: Vec[] = [
    [x + w, y, z],
    [x + w, y + d, z],
    [x + w, y + d, z + h],
    [x + w, y, z + h],
  ]
  const top: Vec[] = [
    [x, y, z + h],
    [x + w, y, z + h],
    [x + w, y + d, z + h],
    [x, y + d, z + h],
  ]
  const topClass = box.tone === "accent" ? "help-face-accent" : "help-face-top"
  const rightClass =
    box.tone === "accent" ? "help-face-accent-side" : "help-face-right"
  return (
    <g>
      <polygon className="help-face-left" points={polygon(left)} />
      <polygon className={rightClass} points={polygon(right)} />
      <polygon className={topClass} points={polygon(top)} />
    </g>
  )
}

const SCENES: Record<HelpTopicId, Scene> = {
  "getting-started": {
    boxesBackToFront: [
      { at: [0.35, 0.25, 0], size: [3.1, 2.15, 0.16] },
      { at: [0.7, 0.7, 0.16], size: [0.16, 0.16, 2.05] },
      { at: [2.55, 0.7, 0.16], size: [0.16, 0.16, 2.05] },
      { at: [0.7, 0.7, 2.21], size: [2.01, 0.16, 0.16] },
      { at: [0.98, 0.82, 0.16], size: [1.4, 0.12, 1.85] },
      { at: [2.05, 0.9, 1.0], size: [0.16, 0.2, 0.16], tone: "accent" },
    ],
  },
  paper: {
    boxesBackToFront: [
      { at: [0.45, 0.2, 0], size: [2.7, 1.95, 0.1] },
      { at: [0.62, 0.42, 0.1], size: [2.7, 1.95, 0.1] },
      { at: [0.8, 0.64, 0.2], size: [2.7, 1.95, 0.1] },
      { at: [1.1, 0.95, 0.3], size: [1.7, 0.08, 0.05], tone: "accent" },
      { at: [1.1, 1.2, 0.3], size: [1.35, 0.08, 0.05] },
      { at: [1.1, 1.45, 0.3], size: [1.55, 0.08, 0.05] },
    ],
  },
  apply: {
    boxesBackToFront: [
      { at: [0.05, 0.15, 0], size: [4.15, 2.15, 0.14] },
      { at: [0.28, 0.45, 0.14], size: [1.05, 1.5, 0.9] },
      { at: [2.85, 0.45, 0.14], size: [1.05, 1.5, 1.2] },
      { at: [1.55, 0.45, 0.14], size: [1.05, 1.5, 1.65], tone: "accent" },
    ],
  },
  coach: {
    boxesBackToFront: [
      { at: [0.7, 0.45, 0], size: [2.15, 1.55, 0.16] },
      { at: [1.55, 1.0, 0.16], size: [0.26, 0.26, 1.55] },
      { at: [0.75, 0.35, 1.71], size: [1.65, 1.15, 0.2], tone: "accent" },
      { at: [0.9, 0.5, 1.91], size: [1.35, 0.85, 0.12] },
    ],
  },
  plans: {
    boxesBackToFront: [
      { at: [0.25, 0.55, 0], size: [1.55, 1.45, 1.15] },
      { at: [2.0, 0.3, 0], size: [1.7, 1.6, 2.15], tone: "accent" },
    ],
  },
  account: {
    boxesBackToFront: [
      { at: [0.3, 0.35, 0], size: [2.7, 1.7, 0.14] },
      { at: [0.55, 0.7, 0.14], size: [1.7, 0.14, 1.45] },
      { at: [2.15, 0.85, 0.14], size: [0.62, 0.62, 0.5], tone: "accent" },
      { at: [2.28, 0.98, 0.64], size: [0.36, 0.36, 0.28] },
    ],
  },
}

export function HelpFigure({ id }: { id: HelpTopicId }) {
  return (
    <svg
      className="help-figure"
      viewBox="0 0 128 108"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse className="help-shadow" cx="64" cy="96" rx="34" ry="6" />
      {SCENES[id].boxesBackToFront.map((box, index) => (
        <BoxShape key={index} box={box} />
      ))}
    </svg>
  )
}
