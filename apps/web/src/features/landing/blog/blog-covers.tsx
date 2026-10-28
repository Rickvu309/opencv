import type { ReactNode } from "react"

import { B2bCoverArt } from "./b2b-cover-art.tsx"
import {
  BLOG_COVER_STORIES,
  type BlogCoverKey,
  type BlogCoverStory,
} from "./blog-cover-stories.ts"

function Label({
  x,
  y,
  children,
  size = 20,
  muted = false,
  weight = 500,
}: {
  x: number
  y: number
  children: ReactNode
  size?: number
  muted?: boolean
  weight?: number
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontWeight={weight}
      fill={muted ? "var(--muted-foreground)" : "currentColor"}
    >
      {children}
    </text>
  )
}

function Arrow({ x, y, width = 40 }: { x: number; y: number; width?: number }) {
  return (
    <path
      d={`M${x} ${y}h${width}m-6-6 6 6-6 6`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

function Paper({
  x,
  y,
  width,
  height,
  children,
}: {
  x: number
  y: number
  width: number
  height: number
  children?: ReactNode
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={10}
        fill="var(--card)"
        stroke="var(--foreground)"
        strokeWidth={1.25}
      />
      {children}
    </g>
  )
}

function Rules({
  x,
  y,
  width = 100,
  rows = 3,
}: {
  x: number
  y: number
  width?: number
  rows?: number
}) {
  return (
    <g stroke="var(--border)" strokeWidth={3} strokeLinecap="round">
      {Array.from({ length: rows }, (_, index) => (
        <path
          key={index}
          d={`M${x} ${y + index * 15}h${width - (index === rows - 1 ? 24 : 0)}`}
        />
      ))}
    </g>
  )
}

function Story({ story }: { story: BlogCoverStory }) {
  switch (story.kind) {
    case "result":
      return (
        <>
          <Paper x={28} y={102} width={208} height={110}>
            <Label x={48} y={130} size={16} muted>
              DUTY
            </Label>
            <Label x={48} y={162}>
              {story.duty}
            </Label>
            <Rules x={48} y={185} width={130} rows={1} />
          </Paper>
          <Arrow x={249} y={157} width={30} />
          <Paper x={294} y={64} width={278} height={192}>
            <Label x={316} y={94} size={16} muted>
              RESULT
            </Label>
            <Label x={316} y={143} size={32}>
              {story.before}
            </Label>
            <Arrow x={389} y={132} width={28} />
            <Label x={433} y={143} size={32}>
              {story.after}
            </Label>
            <Label x={316} y={174} size={18} muted>
              {story.measure}
            </Label>
            <path
              d="M318 230v-18h36v18m22 0v-30h36v30m22 0v-46h36v46m22 0v-64h36v64"
              fill="var(--secondary)"
              stroke="currentColor"
              strokeWidth={1.25}
            />
          </Paper>
        </>
      )
    case "shortlist":
      return (
        <>
          {[0, 1, 2].map((index) => (
            <Paper
              key={index}
              x={50 + index * 12}
              y={58 + index * 12}
              width={164}
              height={174}
            />
          ))}
          <Rules x={99} y={119} width={95} rows={5} />
          <Label x={74} y={274} muted>
            {story.generic}
          </Label>
          <Arrow x={268} y={158} width={47} />
          <Paper x={348} y={72} width={196} height={160}>
            <Label x={369} y={105}>
              {story.specific}
            </Label>
            {[0, 1, 2, 3, 4].map((index) => (
              <g key={index} transform={`translate(${370 + index * 31} 125)`}>
                <rect
                  width={23}
                  height={37}
                  rx={3}
                  fill="var(--secondary)"
                  stroke="currentColor"
                />
                <path
                  d="m6 18 4 4 7-9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                />
              </g>
            ))}
            <Rules x={369} y={188} width={145} rows={2} />
          </Paper>
          <Label x={348} y={274} size={18}>
            {story.caption}
          </Label>
        </>
      )
    case "focus":
      return (
        <>
          <Paper x={185} y={25} width={230} height={270}>
            <path d="M196 35h208v111H196z" fill="var(--secondary)" />
            {story.edits.map((label, index) => (
              <g key={label}>
                <circle
                  cx={210}
                  cy={59 + index * 32}
                  r={3}
                  fill="currentColor"
                />
                <Label x={223} y={64 + index * 32}>
                  {label}
                </Label>
              </g>
            ))}
            <path d="M205 160h190" stroke="var(--border)" />
            <Rules x={207} y={181} width={182} rows={6} />
          </Paper>
          <path
            d="M170 36h-12v110h12m260 18h12v118h-12"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          />
          <Label x={47} y={91} size={18}>
            Tailor this
          </Label>
          <Label x={460} y={228} size={18} muted>
            Keep the rest
          </Label>
        </>
      )
    case "timeline":
      return (
        <>
          <path d="M76 72h448" stroke="currentColor" strokeWidth={1.5} />
          <circle
            cx={76}
            cy={72}
            r={5}
            fill="var(--card)"
            stroke="currentColor"
            strokeWidth={1.5}
          />
          <circle cx={524} cy={72} r={5} fill="currentColor" />
          <Label x={47} y={48} size={18}>
            {story.start}
          </Label>
          <Label x={245} y={48} size={18} muted>
            {story.interval}
          </Label>
          <Label x={487} y={48} size={18}>
            {story.end}
          </Label>
          <path
            d="M524 78v39h-88"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          />
          <Paper x={155} y={117} width={290} height={158}>
            <path d="M155 159h290" stroke="var(--border)" />
            <path
              d="m176 132 10 8 10-8m-20 0h20v14h-20z"
              stroke="currentColor"
              fill="none"
              strokeLinejoin="round"
            />
            <Label x={210} y={143} size={18}>
              A useful note
            </Label>
            <Label x={180} y={191}>
              {story.note[0]}
            </Label>
            <Label x={180} y={227}>
              {story.note[1]}
            </Label>
            <path d="M180 233h93" stroke="currentColor" />
            <path
              d="m404 218 12 8-12 8m12-8h-23"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          </Paper>
        </>
      )
    case "conversation":
      return (
        <>
          <Label x={42} y={67} size={18} muted>
            Ask first
          </Label>
          <path
            d="M42 90h229a10 10 0 0 1 10 10v75a10 10 0 0 1-10 10H80l-22 20v-20H42a10 10 0 0 1-10-10v-75a10 10 0 0 1 10-10Z"
            fill="var(--card)"
            stroke="currentColor"
            strokeWidth={1.25}
          />
          <Label x={56} y={145}>
            {story.question}
          </Label>
          <Arrow x={296} y={143} width={30} />
          <Label x={350} y={67} size={18} muted>
            Then show
          </Label>
          <Paper x={346} y={90} width={222} height={159}>
            <Label x={366} y={122}>
              {story.evidence}
            </Label>
            <Rules x={366} y={148} width={158} rows={2} />
            <rect
              x={366}
              y={188}
              width={56}
              height={36}
              rx={3}
              fill="var(--secondary)"
            />
            <path
              d="m382 207 6 6 12-14"
              stroke="currentColor"
              fill="none"
              strokeWidth={1.5}
            />
            <Rules x={437} y={196} width={101} rows={2} />
          </Paper>
        </>
      )
    case "publication":
      return (
        <>
          <rect
            x={28}
            y={134}
            width={158}
            height={42}
            rx={21}
            fill="var(--secondary)"
            stroke="var(--muted-foreground)"
          />
          <circle cx={49} cy={155} r={4} fill="var(--muted-foreground)" />
          <Label x={63} y={160} size={18} muted>
            {story.status}
          </Label>
          <Arrow x={207} y={155} width={40} />
          <Label x={275} y={45} size={18}>
            {story.artifact}
          </Label>
          <Paper x={273} y={65} width={299} height={211}>
            <path d="M273 96h299" stroke="var(--border)" />
            {[289, 299, 309].map((x) => (
              <circle
                key={x}
                cx={x}
                cy={81}
                r={2}
                fill="var(--muted-foreground)"
              />
            ))}
            <Label x={294} y={126} size={17} muted>
              Before
            </Label>
            <Label x={440} y={126} size={17}>
              After
            </Label>
            <rect
              x={294}
              y={140}
              width={94}
              height={64}
              rx={3}
              fill="var(--secondary)"
            />
            <Rules x={304} y={155} width={66} rows={3} />
            <Arrow x={400} y={173} width={22} />
            <rect
              x={439}
              y={140}
              width={110}
              height={64}
              rx={3}
              fill="var(--secondary)"
              stroke="currentColor"
            />
            <path
              d="M450 153h88m-88 12h54m-54 12h88m-88 12h66"
              stroke="currentColor"
            />
            <Label x={294} y={246} size={18}>
              View the case
            </Label>
            <path
              d="M294 251h92m146-16 9 0 0 9m-9 0 9-9"
              stroke="currentColor"
              fill="none"
              strokeWidth={1.25}
            />
          </Paper>
        </>
      )
  }
}

export function BlogCoverArt({
  cover,
  decorative = false,
}: {
  cover: BlogCoverKey
  decorative?: boolean
}) {
  const accessibility = decorative
    ? { "aria-hidden": true as const }
    : {
        role: "img",
        "aria-label":
          cover === "b2b-sales"
            ? "A CV page, a chart, and an open briefcase."
            : BLOG_COVER_STORIES[cover].description,
      }
  if (cover === "b2b-sales") {
    return (
      <div className="blog-cover-art" {...accessibility}>
        <B2bCoverArt />
      </div>
    )
  }
  return (
    <svg viewBox="0 0 600 320" className="blog-cover-story" {...accessibility}>
      <Story story={BLOG_COVER_STORIES[cover]} />
    </svg>
  )
}
