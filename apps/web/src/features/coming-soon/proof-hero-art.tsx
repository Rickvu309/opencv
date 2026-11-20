import type { CSSProperties } from "react"
import { BadgeCheck, FileText, Play } from "lucide-react"

const STAGE_W = 1059
const STAGE_H = 560

const AREA =
  "M120 470l54-6.8 54 0 54-13.6 54-20.5 54-13.6 54-40.8 54-20.4 54-13.7 54-40.8 54-20.4 54-27.3 54-27.2 54-27.2 54-27.3 54-20.4 0 410-810 0z"
const LINE =
  "M120 470l54-6.8 54 0 54-13.6 54-20.5 54-13.6 54-40.8 54-20.4 54-13.7 54-40.8 54-20.4 54-27.3 54-27.2 54-27.2 54-27.3 54-20.4"

const GRID_X = [96, 192, 288, 384, 480, 576, 672, 768, 864, 960, 1056]
const GRID_Y = [140, 280, 420]

const VIDEO_POINTS = [
  { label: "142k", dot: [438, 368.68] },
  { label: "118k", dot: [600, 293.79] },
  { label: "205k", dot: [762, 218.89] },
] as const

const SHADOW = "shadow-[0_1px_2px_rgb(0_0_0/0.05),0_12px_32px_rgb(0_0_0/0.08)]"
const FLOATING = `border border-foreground/6 bg-card ${SHADOW}`

function at(x: number, y: number): CSSProperties {
  return {
    left: `${((x / STAGE_W) * 100).toFixed(3)}%`,
    top: `${((y / STAGE_H) * 100).toFixed(3)}%`,
  }
}

export function ProofHeroArt() {
  return (
    <div
      aria-hidden="true"
      className="relative flex flex-col overflow-hidden rounded-[18px] bg-linear-to-b from-background to-muted ring-1 ring-border/60 ring-inset lg:block lg:h-[560px]"
    >
      <div className="[container-type:inline-size] relative aspect-[1059/560] lg:absolute lg:inset-0 lg:aspect-auto">
        <svg
          viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
        >
          <defs>
            <linearGradient
              id="proof-area"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="0"
              y2={STAGE_H}
            >
              <stop
                offset="0"
                stopColor="var(--foreground)"
                stopOpacity="0.09"
              />
              <stop offset="1" stopColor="var(--foreground)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g
            fill="none"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            className="stroke-border/40"
          >
            {GRID_X.map((x) => (
              <path
                key={x}
                d={`M${x + 0.5} 0V${STAGE_H}`}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {GRID_Y.map((y) => (
              <path
                key={y}
                d={`M0 ${y + 0.5}H${STAGE_W}`}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
          <path d={AREA} fill="url(#proof-area)" />
          <path
            d={LINE}
            fill="none"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="stroke-foreground"
          />
        </svg>
        {VIDEO_POINTS.map(({ dot: [x, y], label }) => (
          <span
            key={label}
            style={at(x, y)}
            className="absolute size-3 rounded-full border-[2.5px] border-foreground bg-card"
          />
        ))}
        <span
          style={at(114, 464)}
          className="absolute size-3 rounded-full border-[2.5px] border-foreground bg-card"
        />
        <span
          style={at(910, 130)}
          className="absolute size-10 rounded-full bg-foreground/10"
        />
        <span
          style={at(922, 142)}
          className="absolute size-4 rounded-full bg-foreground"
        />
        <span
          style={at(48, 44)}
          className="absolute text-[12.46cqw] leading-none font-semibold tracking-[-0.0455em] text-foreground lg:text-[132px]"
        >
          +38%
        </span>
        <span
          style={at(58, 186)}
          className="absolute text-[max(12px,1.7cqw)] text-muted-foreground/90 lg:text-[18px]"
        >
          followers
        </span>
      </div>
      {VIDEO_POINTS.map(({ dot: [x, y], label }) => (
        <span
          key={label}
          style={at(x - 28, y - 42)}
          className={`absolute hidden h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] leading-[1.21] font-medium text-foreground lg:flex ${FLOATING}`}
        >
          <Play className="size-[11px]" />
          {label}
        </span>
      ))}
      <span
        style={at(120, 476)}
        className="absolute hidden h-4 w-px bg-foreground/40 lg:block"
      />
      <span
        style={at(930, 96)}
        className="absolute hidden h-[34px] w-px bg-foreground/40 lg:block"
      />
      <div className="flex flex-wrap items-center gap-3 p-4 lg:contents">
        <span
          style={at(96, 492)}
          className={`flex h-10 w-fit items-center gap-2 rounded-[10px] px-3.5 text-[13.5px] leading-[1.21] whitespace-nowrap text-foreground/90 lg:absolute ${FLOATING}`}
        >
          <FileText className="size-3.5 text-muted-foreground/70" />
          Grew followers by
          <span className="flex h-[22px] items-center rounded bg-foreground px-1.5 font-semibold text-background">
            38%
          </span>
          in four months.
        </span>
        <span
          style={{
            top: `${((44 / STAGE_H) * 100).toFixed(3)}%`,
            right: `calc(${(((STAGE_W - 930) / STAGE_W) * 100).toFixed(3)}% - 84px)`,
          }}
          className={`flex h-[52px] w-fit items-center gap-2.5 rounded-full pr-4 pl-[9px] leading-[1.21] whitespace-nowrap lg:absolute ${FLOATING}`}
        >
          <span className="flex size-[34px] items-center justify-center rounded-full bg-muted text-[11.5px] font-semibold text-foreground/85">
            NA
          </span>
          <span className="text-[13px] font-semibold text-foreground">
            Manager confirmed
          </span>
          <BadgeCheck className="size-[18px] text-foreground" />
        </span>
      </div>
    </div>
  )
}
