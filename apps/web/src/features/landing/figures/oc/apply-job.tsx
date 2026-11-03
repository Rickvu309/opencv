import * as React from "react"
import {
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Rocket,
  Star,
  Ellipsis,
  Link,
  PanelRight,
  MapPin,
  Calendar,
  Flag,
  FileText,
  Plus,
  MousePointer2,
} from "lucide-react"
import { AppShell } from "./app-shell.tsx"
import { OC, delay, type IconType } from "./palette.ts"
import "./apply-job.css"

function InterviewStatus() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16">
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
}

function SignalBars() {
  return (
    <svg width={14} height={14} viewBox="0 0 12 12">
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={1 + i * 4}
          y={8 - i * 3}
          width="2.2"
          height={3 + i * 3}
          rx="0.6"
          fill={OC.text}
        />
      ))}
    </svg>
  )
}

function CheckCircle({ checked }: { checked?: boolean }) {
  if (checked)
    return (
      <svg width={18} height={18} viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="9" fill={OC.indigo} />
        <path
          d="M5.6 9.2 7.9 11.4 12.4 6.8"
          fill="none"
          stroke="var(--card)"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  return (
    <svg width={18} height={18} viewBox="0 0 18 18">
      <circle
        cx="9"
        cy="9"
        r="8.25"
        fill="none"
        stroke="var(--input)"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function HeaderIcon({ icon: Icon }: { icon: IconType }) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={17} strokeWidth={1.7} color={OC.icon} />
    </div>
  )
}

function Section({
  title,
  d,
  children,
}: {
  title: string
  d: number
  children: React.ReactNode
}) {
  return (
    <div
      className="oc-in-up"
      style={{ ...delay(d), display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div
        style={{ margin: 0, fontSize: 16, lineHeight: "22px", fontWeight: 600 }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul
      style={{
        margin: 0,
        padding: 0,
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {items.map((item) => (
        <li
          key={item}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 15,
            fontSize: 16,
            lineHeight: "22px",
            color: OC.body,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              marginLeft: 3,
              borderRadius: 3,
              background: "var(--chart-5)",
              flexShrink: 0,
            }}
          />
          {item}
        </li>
      ))}
    </ul>
  )
}

function ChecklistRow({
  label,
  checked,
  children,
}: {
  label: React.ReactNode
  checked?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      style={{
        position: "relative",
        height: 38,
        display: "flex",
        alignItems: "center",
        gap: 12,
        paddingLeft: 7,
        borderBottom: "1px solid var(--muted)",
      }}
    >
      <span
        style={{ position: "relative", display: "flex", width: 18, height: 18 }}
      >
        <CheckCircle checked={checked} />
        {children}
      </span>
      <span style={{ fontSize: 16, color: checked ? OC.muted : OC.text }}>
        {label}
      </span>
    </div>
  )
}

function PropRow({
  icon,
  label,
  muted,
  d,
}: {
  icon: React.ReactNode
  label: string
  muted?: boolean
  d: number
}) {
  return (
    <div
      className="oc-in-up"
      style={{
        ...delay(d),
        height: 37.6,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span style={{ width: 16, display: "flex", justifyContent: "center" }}>
        {icon}
      </span>
      <span style={{ fontSize: 15.5, color: muted ? OC.muted : OC.text }}>
        {label}
      </span>
    </div>
  )
}

function RailLabel({ label, d }: { label: string; d: number }) {
  return (
    <div
      className="oc-in-up"
      style={{
        ...delay(d),
        height: 24,
        display: "flex",
        alignItems: "center",
        gap: 5,
        fontSize: 14.5,
        color: OC.muted,
      }}
    >
      {label}
      <ChevronDown size={13} strokeWidth={1.8} />
    </div>
  )
}

export function ApplyJobAnimated({
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
          height: 58,
          flexShrink: 0,
          padding: "0 20px 0 21px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: `1px solid ${OC.border}`,
        }}
      >
        <span style={{ fontSize: 15, color: OC.secondary }}>Apply</span>
        <ChevronRight size={14} strokeWidth={1.8} color={OC.muted} />
        <Rocket size={15} strokeWidth={1.8} color={OC.text} />
        <span style={{ fontSize: 15, fontWeight: 500, marginLeft: -3 }}>
          Associate PM intern
        </span>
        <Star
          size={16}
          strokeWidth={1.7}
          color={OC.icon}
          style={{ marginLeft: 12 }}
        />
        <Ellipsis
          size={17}
          strokeWidth={1.8}
          color={OC.icon}
          style={{ marginLeft: 12 }}
        />
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 14.5, color: OC.muted, marginRight: 18 }}>
          1 / 7
        </span>
        <HeaderIcon icon={ChevronUp} />
        <HeaderIcon icon={ChevronDown} />
        <HeaderIcon icon={Link} />
        <HeaderIcon icon={PanelRight} />
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          <div
            className="oc-loop oc-scroll"
            style={{
              width: 754,
              marginLeft: 122,
              paddingTop: 41,
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            <div
              className="oc-in-up"
              style={{
                ...delay(240),
                display: "flex",
                flexDirection: "column",
                gap: 9,
              }}
            >
              <div
                style={{
                  margin: 0,
                  fontSize: 29,
                  lineHeight: "36px",
                  fontWeight: 600,
                  letterSpacing: -0.5,
                }}
              >
                Associate PM intern
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span
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
                  <Rocket size={13} strokeWidth={1.8} color={OC.text} />
                </span>
                <span style={{ fontSize: 16.5, color: OC.secondary }}>
                  Local startup
                </span>
              </div>
            </div>

            <Section title="About the role" d={300}>
              <p
                style={{
                  margin: 0,
                  fontSize: 16,
                  lineHeight: "25px",
                  color: OC.body,
                }}
              >
                Join a 12-person team building a savings app for students. You
                will own small features from idea to launch.
              </p>
            </Section>

            <Section title="What you'll do" d={350}>
              <Bullets
                items={[
                  "Run user interviews and turn notes into clear problems",
                  "Write short specs with two engineers",
                  "Track what changed after each release",
                ]}
              />
            </Section>

            <Section title="What they look for" d={400}>
              <Bullets
                items={[
                  "Final-year student or recent graduate",
                  "Clear writing in English and Vietnamese",
                  "Curious about how people manage money",
                ]}
              />
            </Section>

            <Section title="Details" d={450}>
              <Bullets
                items={[
                  "6-month internship, starting January",
                  "Hybrid in Hanoi, 3 days in the office",
                  "Paid, 6 to 8 million VND a month",
                ]}
              />
            </Section>

            <div
              className="oc-in-up"
              style={{
                ...delay(500),
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  height: 30,
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  paddingLeft: 2,
                  marginBottom: 2,
                }}
              >
                <ChevronDown size={14} strokeWidth={1.8} color={OC.muted} />
                <span style={{ fontSize: 16, fontWeight: 500 }}>
                  Interview prep
                </span>
                <span
                  style={{
                    display: "inline-grid",
                    fontSize: 15,
                    color: OC.muted,
                  }}
                >
                  <span
                    className="oc-loop oc-count-old"
                    style={{ gridArea: "1 / 1" }}
                  >
                    1/3
                  </span>
                  <span
                    className="oc-loop oc-count-new"
                    style={{ gridArea: "1 / 1", opacity: 0 }}
                  >
                    2/3
                  </span>
                </span>
                <span style={{ flex: 1 }} />
                <Plus
                  size={16}
                  strokeWidth={1.7}
                  color={OC.icon}
                  style={{ marginRight: 6 }}
                />
              </div>
              <ChecklistRow label="Read about their savings app" checked />
              <ChecklistRow
                label={
                  <span className="oc-loop oc-check-text">
                    Practise three PM questions
                  </span>
                }
              >
                <span
                  className="oc-loop oc-check"
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    opacity: 0,
                  }}
                >
                  <CheckCircle checked />
                </span>
                <span
                  className="oc-loop oc-cursor oc-ghost"
                  style={{
                    position: "absolute",
                    left: 6,
                    top: 7,
                    zIndex: 2,
                    display: "flex",
                    pointerEvents: "none",
                    opacity: 0,
                  }}
                >
                  <MousePointer2
                    size={22}
                    strokeWidth={1.5}
                    color="var(--card)"
                    fill={OC.text}
                  />
                </span>
              </ChecklistRow>
              <ChecklistRow label="Bring the checkout study" />
            </div>

            <div
              className="oc-in-up"
              style={{
                ...delay(550),
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginTop: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    margin: 0,
                    flex: 1,
                    fontSize: 17,
                    lineHeight: "24px",
                    fontWeight: 600,
                  }}
                >
                  Activity
                </div>
                <span style={{ fontSize: 15, color: OC.muted }}>Subscribe</span>
              </div>
              <div
                style={{
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  paddingLeft: 8,
                  fontSize: 15.5,
                }}
              >
                <Plus size={15} strokeWidth={1.7} color={OC.muted} />
                <span style={{ color: OC.secondary }}>
                  You added this job from ITviec
                </span>
                <span style={{ color: OC.muted }}>Oct 10</span>
              </div>
              <div
                className="oc-loop oc-activity-new"
                style={{
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  paddingLeft: 8,
                  fontSize: 15.5,
                  opacity: 0,
                }}
              >
                <span
                  style={{
                    width: 15,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <CheckCircle checked />
                </span>
                <span style={{ color: OC.secondary }}>
                  You checked Practise three PM questions
                </span>
                <span style={{ color: OC.muted }}>Just now</span>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            width: 320,
            flexShrink: 0,
            borderLeft: `1px solid ${OC.border}`,
            padding: "21px 24px 0 30px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <RailLabel label="Properties" d={320} />
          <div
            style={{ marginTop: 8, display: "flex", flexDirection: "column" }}
          >
            <PropRow d={360} icon={<InterviewStatus />} label="Interview" />
            <PropRow d={390} icon={<SignalBars />} label="High priority" />
            <PropRow
              d={420}
              icon={<MapPin size={16} strokeWidth={1.8} color={OC.pin} />}
              label="Hanoi"
            />
            <PropRow
              d={450}
              icon={<Calendar size={16} strokeWidth={1.8} color={OC.pin} />}
              label="Interview Oct 29, 10:00"
            />
            <PropRow
              d={480}
              icon={<Flag size={16} strokeWidth={1.7} color={OC.muted} />}
              label="Add deadline"
              muted
            />
            <PropRow
              d={510}
              icon={
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    background: "var(--muted)",
                    fontSize: 7,
                    fontWeight: 600,
                    color: OC.secondary,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  MT
                </span>
              }
              label="Minh Tran"
            />
            <PropRow
              d={540}
              icon={<Link size={15} strokeWidth={1.8} color={OC.icon} />}
              label="itviec.com"
            />
          </div>
          <div style={{ marginTop: 22 }}>
            <RailLabel label="Paper" d={580} />
          </div>
          <div
            style={{ marginTop: 8, display: "flex", flexDirection: "column" }}
          >
            <PropRow
              d={620}
              icon={<FileText size={16} strokeWidth={1.7} color={OC.icon} />}
              label="Junior Marketing CV"
            />
            <PropRow
              d={650}
              icon={<Plus size={16} strokeWidth={1.7} color={OC.muted} />}
              label="Add cover letter"
              muted
            />
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export default ApplyJobAnimated
