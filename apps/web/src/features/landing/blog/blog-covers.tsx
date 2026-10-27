import type { ReactNode } from "react"

import type { BlogCoverKey } from "./blog-copy.ts"

type Pt = [number, number, number]

const TOP = "var(--background)"
const FRONT = "var(--card)"
const SIDE = "var(--muted)"
const INK = "color-mix(in oklch, var(--foreground) 16%, var(--muted))"

function project(x: number, y: number, z: number): [number, number] {
  const scale = 1.35
  return [(x - y) * 0.8660254 * scale, ((x + y) * 0.5 - z) * scale]
}

function face(points: Pt[]): string {
  return points
    .map((point, index) => {
      const [sx, sy] = project(point[0], point[1], point[2])
      return `${index === 0 ? "M" : "L"}${sx.toFixed(2)} ${sy.toFixed(2)}`
    })
    .join("")
    .concat("Z")
}

function Box({
  x,
  y,
  z,
  w,
  d,
  h,
  top = TOP,
  front = FRONT,
  side = SIDE,
}: {
  x: number
  y: number
  z: number
  w: number
  d: number
  h: number
  top?: string
  front?: string
  side?: string
}) {
  const stroke = "currentColor"
  return (
    <g
      stroke={stroke}
      strokeOpacity={0.28}
      strokeWidth={1.1}
      strokeLinejoin="round"
    >
      <path
        d={face([
          [x, y, z + h],
          [x + w, y, z + h],
          [x + w, y + d, z + h],
          [x, y + d, z + h],
        ])}
        fill={top}
      />
      <path
        d={face([
          [x + w, y, z],
          [x + w, y + d, z],
          [x + w, y + d, z + h],
          [x + w, y, z + h],
        ])}
        fill={side}
      />
      <path
        d={face([
          [x, y + d, z],
          [x + w, y + d, z],
          [x + w, y + d, z + h],
          [x, y + d, z + h],
        ])}
        fill={front}
      />
    </g>
  )
}

function Rules({
  x,
  y,
  z,
  w,
  d,
  h,
  rows,
}: {
  x: number
  y: number
  z: number
  w: number
  d: number
  h: number
  rows: number
}) {
  const yf = y + d
  const lines = []
  for (let index = 0; index < rows; index += 1) {
    const zz = z + h * (0.72 - index * 0.1)
    const [x1, y1] = project(x + w * 0.16, yf, zz)
    const [x2, y2] = project(x + w * 0.84, yf, zz)
    lines.push(
      <line
        key={index}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="currentColor"
        strokeOpacity={0.4}
        strokeWidth={1.15}
        strokeLinecap="round"
      />
    )
  }
  return <g>{lines}</g>
}

function Arrow({ from, to }: { from: Pt; to: Pt }) {
  const [x1, y1] = project(from[0], from[1], from[2])
  const [x2, y2] = project(to[0], to[1], to[2])
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const head = 8
  const spread = 0.42
  const neck = 7
  const tipX = x2
  const tipY = y2
  const left = [
    tipX - head * Math.cos(angle - spread),
    tipY - head * Math.sin(angle - spread),
  ]
  const right = [
    tipX - head * Math.cos(angle + spread),
    tipY - head * Math.sin(angle + spread),
  ]
  return (
    <g fill="currentColor" stroke="currentColor" opacity={0.72}>
      <line
        x1={x1}
        y1={y1}
        x2={tipX - neck * Math.cos(angle)}
        y2={tipY - neck * Math.sin(angle)}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <polygon
        points={`${tipX},${tipY} ${left[0]},${left[1]} ${right[0]},${right[1]}`}
      />
    </g>
  )
}

function Sheet({
  x,
  y,
  z = 0,
  w = 40,
  h = 58,
  rows = 4,
}: {
  x: number
  y: number
  z?: number
  w?: number
  h?: number
  rows?: number
}) {
  return (
    <g>
      <Box x={x} y={y} z={z} w={w} d={4.5} h={h} />
      <Rules x={x} y={y} z={z} w={w} d={4.5} h={h} rows={rows} />
    </g>
  )
}

function Scene({
  label,
  decorative = false,
  children,
}: {
  label: string
  decorative?: boolean
  children: ReactNode
}) {
  return (
    <svg
      viewBox="0 0 520 320"
      className="blog-cover-art"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
    >
      <g transform="translate(260 214)">
        <ellipse
          cx="0"
          cy="18"
          rx="168"
          ry="16"
          fill="currentColor"
          opacity={0.06}
        />
        {children}
      </g>
    </svg>
  )
}

function CoverB2b({ decorative }: { decorative?: boolean }) {
  return (
    <Scene
      label="A CV page, a chart, and an open briefcase."
      decorative={decorative}
    >
      <Sheet x={-168} y={-6} w={44} h={64} rows={5} />
      <Arrow from={[-112, 4, 34]} to={[-78, 2, 32]} />
      <Sheet x={-62} y={-4} w={40} h={50} rows={0} />
      <Box
        x={-50}
        y={2}
        z={8}
        w={7}
        d={3}
        h={16}
        top={INK}
        front={INK}
        side={SIDE}
      />
      <Box
        x={-40}
        y={2}
        z={8}
        w={7}
        d={3}
        h={26}
        top={INK}
        front={INK}
        side={SIDE}
      />
      <Box
        x={-30}
        y={2}
        z={8}
        w={7}
        d={3}
        h={34}
        top={INK}
        front={INK}
        side={SIDE}
      />
      <Arrow from={[-8, 4, 28]} to={[22, 0, 26]} />
      <Box x={36} y={-22} z={0} w={62} d={36} h={16} />
      <Box x={36} y={-28} z={16} w={62} d={5} h={32} />
      <Handle x={52} y={-23} z={40} w={30} />
    </Scene>
  )
}

function Handle({
  x,
  y,
  z,
  w,
}: {
  x: number
  y: number
  z: number
  w: number
}) {
  const [x1, y1] = project(x, y, z)
  const [x2, y2] = project(x + w, y, z)
  const [cx, cy] = project(x + w / 2, y, z + 12)
  return (
    <path
      d={`M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      opacity={0.7}
    />
  )
}

function CoverShowWork({ decorative }: { decorative?: boolean }) {
  return (
    <Scene
      label="A duty list beside a result card with one marked line."
      decorative={decorative}
    >
      <Sheet x={-150} y={-4} w={46} h={62} rows={5} />
      <Arrow from={[-92, 4, 32]} to={[-48, 2, 30]} />
      <Sheet x={-28} y={-8} w={52} h={66} rows={2} />
      <Box
        x={-16}
        y={-2}
        z={28}
        w={34}
        d={3}
        h={8}
        top={INK}
        front={INK}
        side={SIDE}
      />
      <Box x={40} y={-28} z={0} w={28} d={22} h={18} />
    </Scene>
  )
}

function CoverFewer({ decorative }: { decorative?: boolean }) {
  return (
    <Scene
      label="A stack of identical pages beside one marked page."
      decorative={decorative}
    >
      <Sheet x={-126} y={-4} z={18} w={42} h={52} rows={3} />
      <Sheet x={-134} y={0} z={12} w={42} h={52} rows={3} />
      <Sheet x={-142} y={4} z={6} w={42} h={52} rows={3} />
      <Sheet x={-150} y={8} z={0} w={42} h={52} rows={3} />
      <Sheet x={-20} y={-6} w={48} h={64} rows={3} />
      <Check x={-4} y={-1.5} z={18} />
    </Scene>
  )
}

function Check({ x, y, z }: { x: number; y: number; z: number }) {
  const [a1, a2] = project(x, y, z)
  const [b1, b2] = project(x + 8, y, z - 8)
  const [c1, c2] = project(x + 22, y, z + 10)
  return (
    <polyline
      points={`${a1},${a2} ${b1},${b2} ${c1},${c2}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={0.8}
    />
  )
}

function CoverTopThird({ decorative }: { decorative?: boolean }) {
  return (
    <Scene
      label="A CV with its top third lifted off the page."
      decorative={decorative}
    >
      <g transform="translate(-30.5 -79.5) scale(1.6) translate(30.5 79.5)">
        <Box x={-70} y={-8} z={0} w={78} d={6} h={46} />
        <Rules x={-70} y={-8} z={0} w={78} d={6} h={46} rows={3} />
        <Box x={-78} y={-16} z={52} w={78} d={6} h={22} />
        <Rules x={-78} y={-16} z={52} w={78} d={6} h={22} rows={2} />
      </g>
    </Scene>
  )
}

function CoverFollowUp({ decorative }: { decorative?: boolean }) {
  return (
    <Scene
      label="An envelope beside a calendar marked with a three."
      decorative={decorative}
    >
      <Box x={-130} y={-8} z={0} w={70} d={48} h={8} />
      <Flap x={-130} y={-8} w={70} d={48} z={8} />
      <Box x={10} y={-16} z={0} w={52} d={8} h={58} />
      <Numeral value="3" x={28} y={-8} z={30} />
    </Scene>
  )
}

function Flap({
  x,
  y,
  w,
  d,
  z,
}: {
  x: number
  y: number
  w: number
  d: number
  z: number
}) {
  return (
    <path
      d={face([
        [x, y + d, z],
        [x + w, y + d, z],
        [x + w / 2, y + d * 0.35, z + 16],
      ])}
      fill={SIDE}
      stroke="currentColor"
      strokeOpacity={0.28}
      strokeWidth={1.1}
      strokeLinejoin="round"
    />
  )
}

function Numeral({
  value,
  x,
  y,
  z,
}: {
  value: string
  x: number
  y: number
  z: number
}) {
  const [sx, sy] = project(x, y, z)
  return (
    <text
      x={sx}
      y={sy}
      textAnchor="middle"
      dominantBaseline="middle"
      fill="currentColor"
      fontSize={22}
      fontFamily="Inter, sans-serif"
      fontWeight={500}
      opacity={0.8}
    >
      {value}
    </text>
  )
}

function CoverDiscovery({ decorative }: { decorative?: boolean }) {
  return (
    <Scene
      label="Two notes facing each other across a low table."
      decorative={decorative}
    >
      <Box x={-40} y={-10} z={0} w={70} d={40} h={8} />
      <Sheet x={-130} y={-20} w={40} h={56} rows={3} />
      <Sheet x={70} y={-16} w={40} h={56} rows={3} />
      <Numeral value="?" x={-112} y={-15} z={34} />
    </Scene>
  )
}

function CoverPublic({ decorative }: { decorative?: boolean }) {
  return (
    <Scene
      label="A pinned card on a board beside a small shipped box."
      decorative={decorative}
    >
      <Box
        x={-120}
        y={-6}
        z={0}
        w={8}
        d={70}
        h={62}
        front={FRONT}
        side={SIDE}
      />
      <Sheet x={-108} y={6} z={16} w={36} h={32} rows={2} />
      <circle
        {...dot(-90, 12, 48)}
        r={3.2}
        fill="currentColor"
        opacity={0.65}
      />
      <Box x={20} y={-8} z={0} w={46} d={34} h={22} />
      <Box
        x={24}
        y={-4}
        z={22}
        w={38}
        d={8}
        h={4}
        top={INK}
        front={INK}
        side={SIDE}
      />
    </Scene>
  )
}

function dot(x: number, y: number, z: number) {
  const [cx, cy] = project(x, y, z)
  return { cx, cy }
}

const COVERS = {
  "b2b-sales": CoverB2b,
  "show-work": CoverShowWork,
  "fewer-applications": CoverFewer,
  "top-third": CoverTopThird,
  "follow-up": CoverFollowUp,
  discovery: CoverDiscovery,
  "in-public": CoverPublic,
} as const satisfies Record<
  BlogCoverKey,
  (props: { decorative?: boolean }) => ReactNode
>

export function BlogCoverArt({
  cover,
  decorative = false,
}: {
  cover: BlogCoverKey
  decorative?: boolean
}) {
  const Art = COVERS[cover]
  return <Art decorative={decorative} />
}
