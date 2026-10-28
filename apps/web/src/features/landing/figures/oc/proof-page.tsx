import * as React from "react"
import {
  ChevronRight,
  ArrowRight,
  Play,
  FileText,
  CircleCheck,
} from "lucide-react"
import { AppShell } from "./app-shell.tsx"
import { OC, delay } from "./palette.ts"
import "./proof-page.css"

/*
 * Loop (8s, after the entrance): the proof builds itself.
 *   2–46%  the line draws left to right; the area fills in behind it
 *          points and their labels pop as the line reaches them (2, 20, 28, 37%)
 *          "+38%" steps +0% → +12% → +27% → +38%
 *   46%    the end dot lands with a halo pulse
 *   50–60% the connector grows, "Manager confirmed" drops in, its check pops
 *   63%    the callout's 38% chip pulses
 *   88–94% the chart fades out and the loop restarts
 * Base styles (static / reduced motion) show the finished chart.
 */

// Chart geometry in card coordinates (card is 1166 × 616).
const LINE: [number, number][] = [
  [132, 516],
  [192, 509],
  [249, 509],
  [312, 495],
  [375, 472],
  [429, 456],
  [488, 411],
  [545, 389],
  [607, 373],
  [665, 329],
  [725, 307],
  [785, 277],
  [844, 247],
  [905, 219],
  [965, 191],
  [1023, 164],
]
const START = LINE[0]
const END = LINE[LINE.length - 1]
const MARKS = [
  { at: [488, 411], label: "142k", t: 20 },
  { at: [665, 329], label: "118k", t: 28 },
  { at: [844, 247], label: "205k", t: 37 },
] as const

const linePath = "M" + LINE.map(([x, y]) => `${x} ${y}`).join(" L")
const areaPath = `${linePath} L${END[0]} 616 L${START[0]} 616 Z`

const counterStyle = (visible: boolean): React.CSSProperties => ({
  gridArea: "1 / 1",
  opacity: visible ? 1 : 0,
})

function ChartLabel({
  x,
  y,
  label,
  className,
}: {
  x: number
  y: number
  label: string
  className: string
}) {
  return (
    <div
      className={`oc-loop ${className}`}
      style={{
        position: "absolute",
        left: x,
        top: y - 52,
        height: 29,
        padding: "0 9px 0 8px",
        transform: "none",
        translate: "-50% 0",
        display: "flex",
        alignItems: "center",
        gap: 5,
        borderRadius: 7,
        background: "var(--card)",
        boxShadow: "0 0 0 1px rgba(0,0,0,.05), 0 2px 6px rgba(0,0,0,.05)",
        fontSize: 14,
        fontWeight: 600,
        color: OC.text,
        whiteSpace: "nowrap",
      }}
    >
      <Play size={11} strokeWidth={2.2} color={OC.text} />
      {label}
    </div>
  )
}

export function ProofPageAnimated({
  animate = true,
  className,
  style,
}: {
  /** Set false to show the settled screen with no motion. */
  animate?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <AppShell
      active="paper"
      animate={animate}
      className={className}
      style={style}
    >
      <div
        className="oc-in-up"
        style={{
          ...delay(150),
          height: 52,
          flexShrink: 0,
          padding: "0 22px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "var(--background)",
          borderBottom: "1px solid var(--muted)",
          fontSize: 15.5,
        }}
      >
        <span style={{ color: OC.secondary }}>Paper</span>
        <ChevronRight size={14} strokeWidth={1.8} color={OC.muted} />
        <span style={{ fontWeight: 500 }}>Proofs</span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: "48px 82px 0 70px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <div
              className="oc-in-up"
              style={{
                ...delay(220),
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                height: 28,
                padding: "0 12px 0 11px",
                borderRadius: 14,
                border: `1px solid ${OC.border}`,
                background: "var(--card)",
                fontSize: 14,
                color: OC.secondary,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  background: "var(--chart-5)",
                }}
              />
              Coming soon
            </div>
            <div
              className="oc-in-up"
              style={{
                ...delay(280),
                margin: "16px 0 0",
                fontSize: 58,
                lineHeight: "66px",
                fontWeight: 700,
                letterSpacing: -2,
                color: OC.text,
              }}
            >
              Back your CV with proof
            </div>
            <p
              className="oc-in-up"
              style={{
                ...delay(340),
                margin: "10px 0 0",
                fontSize: 18.5,
                lineHeight: "26px",
                color: OC.secondary,
              }}
            >
              Turn a CV line into evidence.
            </p>
          </div>
          <div
            className="oc-in-up"
            style={{
              ...delay(360),
              marginBottom: 4,
              height: 43,
              padding: "0 16px 0 18px",
              display: "flex",
              alignItems: "center",
              gap: 9,
              borderRadius: 9,
              background: OC.text,
              color: "var(--card)",
              fontSize: 16.5,
              fontWeight: 600,
            }}
          >
            Get early access
            <ArrowRight size={16} strokeWidth={2} color="var(--card)" />
          </div>
        </div>

        <div
          className="oc-in-up"
          style={{
            ...delay(440),
            position: "relative",
            marginTop: 33,
            width: 1166,
            height: 616,
            flexShrink: 0,
            borderRadius: 20,
            border: "1px solid var(--muted)",
            background:
              "linear-gradient(180deg, var(--background) 0%, var(--secondary) 100%)",
            overflow: "hidden",
          }}
        >
          <svg
            width={1166}
            height={616}
            viewBox="0 0 1166 616"
            style={{ position: "absolute", inset: 0 }}
          >
            <defs>
              <linearGradient id="pf-area-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="black" stopOpacity="0.055" />
                <stop offset="100%" stopColor="black" stopOpacity="0.015" />
              </linearGradient>
            </defs>
            <g stroke="black" strokeOpacity="0.045" strokeWidth="1">
              {Array.from({ length: 10 }, (_, i) => (
                <line
                  key={`v${i}`}
                  x1={107 * (i + 1)}
                  y1={0}
                  x2={107 * (i + 1)}
                  y2={616}
                />
              ))}
              {[205, 410].map((y) => (
                <line key={`h${y}`} x1={0} y1={y} x2={1166} y2={y} />
              ))}
            </g>

            <path
              className="oc-loop pf-area"
              d={areaPath}
              fill="url(#pf-area-fill)"
            />
            <path
              className="oc-loop pf-line"
              d={linePath}
              pathLength={1}
              fill="none"
              stroke={OC.text}
              strokeWidth={2.4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            <line
              x1={START[0]}
              y1={START[1] + 8}
              x2={START[0]}
              y2={539}
              stroke="var(--input)"
              strokeWidth={1.2}
            />

            <circle
              className="oc-loop pf-svg-pop pf-pt0"
              cx={START[0]}
              cy={START[1]}
              r={6.5}
              fill="var(--card)"
              stroke={OC.text}
              strokeWidth={2.2}
            />
            {MARKS.map((m, i) => (
              <circle
                key={m.label}
                className={`oc-loop pf-svg-pop pf-pt${i + 1}`}
                cx={m.at[0]}
                cy={m.at[1]}
                r={6.5}
                fill="var(--card)"
                stroke={OC.text}
                strokeWidth={2.2}
              />
            ))}

            <circle
              className="oc-loop oc-ghost pf-svg-pop pf-ring"
              cx={END[0]}
              cy={END[1]}
              r={21}
              fill="none"
              stroke={OC.text}
              strokeWidth={1.5}
              style={{ opacity: 0 }}
            />
            <circle
              className="oc-loop pf-svg-pop pf-halo"
              cx={END[0]}
              cy={END[1]}
              r={21}
              fill="black"
              fillOpacity={0.08}
            />
            <circle
              className="oc-loop pf-svg-pop pf-end"
              cx={END[0]}
              cy={END[1]}
              r={8.5}
              fill={OC.text}
            />
          </svg>

          <div style={{ position: "absolute", left: 61, top: 46 }}>
            <div
              style={{
                display: "inline-grid",
                fontSize: 150,
                lineHeight: "150px",
                fontWeight: 700,
                letterSpacing: -4,
                color: OC.text,
              }}
            >
              <span className="oc-loop pf-c0" style={counterStyle(false)}>
                +0%
              </span>
              <span className="oc-loop pf-c12" style={counterStyle(false)}>
                +12%
              </span>
              <span className="oc-loop pf-c27" style={counterStyle(false)}>
                +27%
              </span>
              <span className="oc-loop pf-c38" style={counterStyle(true)}>
                +38%
              </span>
            </div>
            <div
              style={{
                marginTop: 12,
                marginLeft: 4,
                fontSize: 18.5,
                color: "var(--chart-5)",
              }}
            >
              followers
            </div>
          </div>

          {MARKS.map((m, i) => (
            <ChartLabel
              key={m.label}
              x={m.at[0]}
              y={m.at[1]}
              label={m.label}
              className={`pf-lb${i + 1}`}
            />
          ))}

          <div
            className="oc-loop pf-conn"
            style={{
              position: "absolute",
              left: END[0] - 0.6,
              top: 103,
              width: 1.2,
              height: END[1] - 103 - 21,
              background: "var(--input)",
            }}
          />
          <div
            className="oc-loop pf-pill"
            style={{
              position: "absolute",
              left: 875,
              top: 52,
              height: 51,
              padding: "0 14px 0 9px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              borderRadius: 26,
              background: "var(--card)",
              boxShadow:
                "0 0 0 1px rgba(0,0,0,.04), 0 6px 18px rgba(0,0,0,.07)",
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                background: "var(--muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 600,
                color: OC.secondary,
              }}
            >
              NA
            </span>
            <span style={{ fontSize: 15.5, fontWeight: 600, color: OC.text }}>
              Manager confirmed
            </span>
            <span className="oc-loop pf-check" style={{ display: "flex" }}>
              <CircleCheck size={18} strokeWidth={1.8} color={OC.text} />
            </span>
          </div>

          <div
            style={{
              position: "absolute",
              left: 105,
              top: 539,
              height: 45,
              padding: "0 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 10,
              background: "var(--card)",
              boxShadow:
                "0 0 0 1px rgba(0,0,0,.04), 0 4px 14px rgba(0,0,0,.06)",
              fontSize: 16.5,
              color: OC.body,
              whiteSpace: "nowrap",
            }}
          >
            <FileText size={16} strokeWidth={1.7} color={OC.muted} />
            <span style={{ marginLeft: 2 }}>Grew followers by</span>
            <span
              className="oc-loop pf-chip"
              style={{
                display: "inline-block",
                padding: "2px 7px",
                borderRadius: 5,
                background: OC.text,
                color: "var(--card)",
                fontWeight: 700,
                fontSize: 15.5,
              }}
            >
              38%
            </span>
            <span>in four months.</span>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export default ProofPageAnimated
