import * as React from "react"

import { AppShell } from "./app-shell.tsx"
import { OC, delay } from "./palette.ts"
import {
  ChevronDown,
  Plus,
  Kanban,
  List,
  Calendar,
  Layers,
  Filter,
  SlidersHorizontal,
  Gem,
  PenTool,
  Landmark,
  ShoppingBag,
  Rocket,
  MapPin,
  MousePointer2,
} from "lucide-react"
import "./apply-board.css"

type Status = "saved" | "applied" | "interview" | "offer" | "closed"

function StatusIcon({ status }: { status: Status }) {
  const s = 16
  if (status === "saved")
    return (
      <svg width={s} height={s} viewBox="0 0 16 16">
        <circle
          cx="8"
          cy="8"
          r="6.75"
          fill="none"
          stroke="var(--chart-5)"
          strokeWidth="1.5"
        />
      </svg>
    )
  if (status === "applied")
    return (
      <svg width={s} height={s} viewBox="0 0 16 16">
        <circle
          cx="8"
          cy="8"
          r="6.75"
          fill="none"
          stroke={OC.amber}
          strokeWidth="1.5"
        />
        <path d="M8 4.25 A3.75 3.75 0 0 1 8 11.75 Z" fill={OC.amber} />
      </svg>
    )
  if (status === "interview")
    return (
      <svg width={s} height={s} viewBox="0 0 16 16">
        <circle
          cx="8"
          cy="8"
          r="6.75"
          fill="none"
          stroke={OC.green}
          strokeWidth="1.5"
        />
        <path d="M8 4.25 A3.75 3.75 0 1 1 4.25 8 L8 8 Z" fill={OC.green} />
      </svg>
    )
  if (status === "offer")
    return (
      <svg width={s} height={s} viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="7.5" fill={OC.indigo} />
        <path
          d="M5 8.2 7.1 10.2 11 6"
          fill="none"
          stroke="var(--card)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  return (
    <svg width={s} height={s} viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="7.5" fill={"var(--chart-5)"} />
      <path
        d="M5.8 5.8 10.2 10.2M10.2 5.8 5.8 10.2"
        stroke="var(--card)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SignalBars({ level }: { level: 1 | 2 | 3 }) {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12">
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={1 + i * 4}
          y={8 - i * 3}
          width="2.2"
          height={3 + i * 3}
          rx="0.6"
          fill={i < level ? OC.text : "var(--input)"}
        />
      ))}
    </svg>
  )
}

function Pill({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ComponentType<{
    size?: number
    strokeWidth?: number
    color?: string
  }>
  label: string
  active?: boolean
}) {
  return (
    <div
      style={{
        height: 32,
        padding: "0 12px",
        borderRadius: 16,
        display: "flex",
        alignItems: "center",
        gap: 7,
        fontSize: 14,
        fontWeight: active ? 500 : 400,
        color: active ? OC.text : OC.body,
        background: active ? "var(--muted)" : "var(--card)",
        border: `1px solid ${active ? "var(--muted)" : "var(--accent)"}`,
      }}
    >
      <Icon size={15} strokeWidth={1.7} color={active ? OC.text : OC.icon} />
      {label}
    </div>
  )
}

function CircleButton({
  icon: Icon,
}: {
  icon: React.ComponentType<{
    size?: number
    strokeWidth?: number
    color?: string
  }>
}) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        border: "1px solid var(--accent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--card)",
      }}
    >
      <Icon size={16} strokeWidth={1.7} color={OC.icon} />
    </div>
  )
}

type Job = {
  icon: React.ComponentType<{
    size?: number
    strokeWidth?: number
    color?: string
  }>
  title: string
  company: string
  level: 1 | 2 | 3
  location: string
  date: string
  interview?: string
}

function JobCard({
  job,
  style,
  className,
  children,
}: {
  job: Job
  style?: React.CSSProperties
  className?: string
  children?: React.ReactNode
}) {
  const Icon = job.icon
  return (
    <div
      className={className}
      style={{
        position: "relative",
        height: job.interview ? 140 : 100,
        padding: "13px 14px",
        background: "var(--card)",
        border: `1px solid ${OC.border}`,
        borderRadius: 10,
        boxShadow: "0 1px 2px rgba(0,0,0,.03)",
        ...style,
      }}
    >
      <div style={{ display: "flex", gap: 11 }}>
        <div
          style={{
            width: 32,
            height: 32,
            flexShrink: 0,
            marginTop: 3,
            borderRadius: 8,
            border: `1px solid ${OC.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={15} strokeWidth={1.8} color={OC.text} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              lineHeight: "20px",
              fontWeight: 500,
              color: OC.text,
            }}
          >
            {job.title}
          </div>
          <div
            style={{
              fontSize: 13.5,
              lineHeight: "19px",
              color: "var(--muted-foreground)",
            }}
          >
            {job.company}
          </div>
        </div>
      </div>
      {job.interview && (
        <div
          style={{
            marginLeft: 43,
            marginTop: 11,
            height: 28,
            padding: "0 9px",
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            borderRadius: 7,
            background: "var(--sidebar)",
            fontSize: 14,
            fontWeight: 500,
            color: OC.text,
          }}
        >
          <Calendar size={14} strokeWidth={1.8} color={OC.pin} />
          {job.interview}
        </div>
      )}
      <div
        style={{
          marginLeft: 43,
          marginTop: job.interview ? 11 : 12,
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            border: `1px solid ${OC.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SignalBars level={job.level} />
        </div>
        <div
          style={{
            height: 24,
            padding: "0 8px 0 7px",
            borderRadius: 6,
            border: `1px solid ${OC.border}`,
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 13.5,
            color: OC.body,
          }}
        >
          <MapPin size={12} strokeWidth={2} color={OC.pin} />
          {job.location}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 13.5, color: OC.muted }}>
          {job.date}
        </span>
      </div>
      {children}
    </div>
  )
}

function Count({
  value,
  swapTo,
  outClass,
  inClass,
}: {
  value: string
  swapTo?: string
  outClass?: string
  inClass?: string
}) {
  if (!swapTo)
    return <span style={{ fontSize: 14, color: OC.muted }}>{value}</span>
  return (
    <span style={{ display: "inline-grid", fontSize: 14, color: OC.muted }}>
      <span className={`oc-loop ${outClass}`} style={{ gridArea: "1 / 1" }}>
        {value}
      </span>
      <span className={`oc-loop ${inClass}`} style={{ gridArea: "1 / 1" }}>
        {swapTo}
      </span>
    </span>
  )
}

function ColumnHeader({
  status,
  label,
  count,
}: {
  status: Status
  label: string
  count: React.ReactNode
}) {
  return (
    <div
      style={{
        height: 40,
        padding: "0 4px",
        display: "flex",
        alignItems: "center",
        gap: 9,
      }}
    >
      <span
        className={status === "offer" ? "oc-loop oc-pulse" : undefined}
        style={{ display: "flex" }}
      >
        <StatusIcon status={status} />
      </span>
      <span style={{ fontSize: 15, color: OC.text }}>{label}</span>
      {count}
    </div>
  )
}

const saved: Job[] = [
  {
    icon: Gem,
    title: "Junior Marketing",
    company: "Lumière Cosmetics",
    level: 3,
    location: "HCMC",
    date: "Oct 25",
  },
  {
    icon: PenTool,
    title: "UX research intern",
    company: "Agency",
    level: 2,
    location: "Hanoi",
    date: "Oct 22",
  },
]
const applied: Job[] = [
  {
    icon: Landmark,
    title: "Business analyst intern",
    company: "Regional bank",
    level: 3,
    location: "HCMC",
    date: "Oct 14",
  },
  {
    icon: ShoppingBag,
    title: "Marketing intern",
    company: "E-commerce co.",
    level: 1,
    location: "Remote",
    date: "Oct 21",
  },
]
const associatePm: Job = {
  icon: Rocket,
  title: "Associate PM intern",
  company: "Local startup",
  level: 3,
  location: "Hanoi",
  date: "Oct 12",
  interview: "Interview Thu, 10:00",
}
const productAnalyst: Job = {
  icon: ShoppingBag,
  title: "Product analyst intern",
  company: "E-commerce co.",
  level: 2,
  location: "Remote",
  date: "Oct 2",
}

const columnStyle = (z: number): React.CSSProperties => ({
  position: "relative",
  zIndex: z,
  width: 271,
  flexShrink: 0,
  padding: "0 9px 9px",
  borderRadius: 10,
  background: OC.subtle,
  display: "flex",
  flexDirection: "column",
  gap: 10,
})

export function ApplyBoardAnimated({
  animate = true,
  className,
  style,
}: {
  animate?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <AppShell
      active="apply"
      animate={animate}
      className={className}
      style={style}
    >
      <div
        style={{
          height: 56,
          flexShrink: 0,
          padding: "0 26px 0 21px",
          display: "flex",
          alignItems: "center",
          borderBottom: `1px solid ${OC.border}`,
        }}
      >
        <span style={{ flex: 1, fontSize: 15 }}>Apply</span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 15,
          }}
        >
          <Plus size={16} strokeWidth={1.7} />
          New job
        </span>
      </div>

      <div
        className="oc-in-up"
        style={{
          ...delay(220),
          height: 52,
          flexShrink: 0,
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        <Pill icon={Kanban} label="Board" active />
        <Pill icon={List} label="List" />
        <Pill icon={Calendar} label="Calendar" />
        <div
          style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Layers size={17} strokeWidth={1.7} color={OC.icon} />
        </div>
        <div style={{ flex: 1 }} />
        <CircleButton icon={Filter} />
        <CircleButton icon={SlidersHorizontal} />
      </div>

      <div
        style={{ flex: 1, padding: "10px 12px 13px", display: "flex", gap: 12 }}
      >
        <div className="oc-in-up" style={{ ...columnStyle(1), ...delay(300) }}>
          <ColumnHeader
            status="saved"
            label="Saved"
            count={<Count value="2" />}
          />
          {saved.map((job, i) => (
            <div
              key={job.title}
              className="oc-in-up"
              style={delay(460 + i * 70)}
            >
              <JobCard job={job} />
            </div>
          ))}
        </div>

        <div className="oc-in-up" style={{ ...columnStyle(1), ...delay(360) }}>
          <ColumnHeader
            status="applied"
            label="Applied"
            count={<Count value="2" />}
          />
          {applied.map((job, i) => (
            <div
              key={job.title}
              className="oc-in-up"
              style={delay(520 + i * 70)}
            >
              <JobCard job={job} />
            </div>
          ))}
        </div>

        {/* Interview: sits above Offer so the dragged card paints over it */}
        <div className="oc-in-up" style={{ ...columnStyle(3), ...delay(420) }}>
          <ColumnHeader
            status="interview"
            label="Interview"
            count={
              <Count
                value="2"
                swapTo="1"
                outClass="oc-int-old"
                inClass="oc-int-new"
              />
            }
          />
          <div
            className="oc-in-up"
            style={{ ...delay(580), position: "relative", zIndex: 2 }}
          >
            <JobCard job={associatePm} className="oc-loop oc-drag">
              <span
                className="oc-loop ab-cursor"
                style={{
                  position: "absolute",
                  right: 58,
                  top: 40,
                  display: "flex",
                  pointerEvents: "none",
                }}
              >
                <MousePointer2
                  size={22}
                  strokeWidth={1.5}
                  color="var(--card)"
                  fill={OC.text}
                />
              </span>
            </JobCard>
          </div>
          <div className="oc-in-up" style={delay(650)}>
            <JobCard job={productAnalyst} className="oc-loop oc-shift" />
          </div>
        </div>

        <div className="oc-in-up" style={{ ...columnStyle(1), ...delay(480) }}>
          <div
            className="oc-loop oc-offer-tint"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 10,
              background: "color-mix(in oklch, var(--chart-3) 6%, var(--card))",
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative" }}>
            <ColumnHeader
              status="offer"
              label="Offer"
              count={
                <Count
                  value="0"
                  swapTo="1"
                  outClass="oc-off-old"
                  inClass="oc-off-new"
                />
              }
            />
          </div>
          <div
            className="oc-loop oc-slot"
            style={{
              position: "absolute",
              top: 40,
              left: 9,
              right: 9,
              height: 140,
              borderRadius: 10,
              border:
                "1.5px dashed color-mix(in oklch, var(--chart-3) 30%, var(--card))",
              background: "color-mix(in oklch, var(--chart-3) 4%, transparent)",
            }}
          />
        </div>

        <div
          className="oc-in-up"
          style={{
            ...delay(540),
            flex: 1,
            padding: "8px 0 0 9px",
            display: "flex",
            flexDirection: "column",
            gap: 9,
          }}
        >
          <div
            style={{
              height: 24,
              padding: "0 7px",
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 13.5,
              color: "var(--muted-foreground)",
            }}
          >
            <ChevronDown size={12} strokeWidth={2} color={OC.muted} />
            Hidden columns
          </div>
          <div
            style={{
              width: 143,
              height: 39,
              padding: "0 12px",
              display: "flex",
              alignItems: "center",
              gap: 9,
              borderRadius: 9,
              border: `1px solid ${OC.border}`,
              background: "var(--card)",
              boxShadow: "0 1px 2px rgba(0,0,0,.04)",
            }}
          >
            <StatusIcon status="closed" />
            <span style={{ fontSize: 15 }}>Closed</span>
            <span style={{ fontSize: 14, color: OC.muted }}>1</span>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export default ApplyBoardAnimated
