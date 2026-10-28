import * as React from "react"
import {
  ChevronRight,
  FileText,
  Star,
  Ellipsis,
  SlidersHorizontal,
  Link,
  Bell,
  MousePointer2,
} from "lucide-react"
import { AppShell } from "./app-shell.tsx"
import { OC, clip, delay } from "./palette.ts"
import { CoachDock } from "./paper-coach-dock.tsx"
import "./paper-editor.css"

function Crumb({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 15, color: OC.body }}>{children}</span>
}

function Sep() {
  return <ChevronRight size={14} strokeWidth={1.8} color={OC.muted} />
}

function SectionHeading({
  label,
  d,
  first,
}: {
  label: string
  d: number
  first?: boolean
}) {
  return (
    <div
      className="oc-in-up"
      style={{
        ...delay(d),
        marginTop: first ? 19 : 27,
        paddingBottom: 5,
        borderBottom: `1px solid ${OC.border}`,
        fontSize: 10.5,
        lineHeight: "14px",
        fontWeight: 700,
        letterSpacing: 0.2,
        color: OC.text,
      }}
    >
      {label}
    </div>
  )
}

function Role({
  title,
  dates,
  d,
  gap = 9,
}: {
  title: string
  dates: string
  d: number
  gap?: number
}) {
  return (
    <div
      className="oc-in-up"
      style={{
        ...delay(d),
        marginTop: gap,
        display: "flex",
        alignItems: "baseline",
        lineHeight: "18px",
      }}
    >
      <span
        style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: OC.text }}
      >
        {title}
      </span>
      <span style={{ fontSize: 11.5, color: OC.muted }}>{dates}</span>
    </div>
  )
}

function Bullet({
  d,
  first,
  children,
}: {
  d: number
  first?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="oc-in-up"
      style={{
        ...delay(d),
        position: "relative",
        marginTop: first ? 2 : 0,
        paddingLeft: 14,
        fontSize: 11.5,
        lineHeight: "22px",
        color: OC.body,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 3,
          top: 9.5,
          width: 3.5,
          height: 3.5,
          borderRadius: 2,
          background: OC.icon,
        }}
      />
      {children}
    </div>
  )
}

/** A bullet Coach retypes: the old line backspaces away, then the new one types in. */
function RetypedBullet({
  i,
  d,
  first,
  from,
  to,
}: {
  i: number
  d: number
  first?: boolean
  from: string
  to: string
}) {
  return (
    <Bullet d={d} first={first}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          verticalAlign: "top",
        }}
      >
        <span
          className={`oc-loop pe-old${i}`}
          style={{ ...clip, maxWidth: 520 }}
        >
          {from}
        </span>
        <span className={`oc-loop pe-new${i}`} style={{ ...clip, maxWidth: 0 }}>
          {to}
        </span>
      </span>
    </Bullet>
  )
}

export function PaperEditorAnimated({
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
      className={["pe-root", className].filter(Boolean).join(" ")}

      panelStyle={{ background: "var(--background)" }}
      overlay={
        <>
          {/* The Coach button's open state. */}
          <span
            className="oc-loop pe-coachpill"
            style={{
              position: "absolute",
              left: 1453,
              top: 960,
              width: 88,
              height: 34,
              borderRadius: 8,
              background: "rgba(0,0,0,.06)",
              pointerEvents: "none",
            }}
          />
          <CoachDock />
          <span
            className="oc-loop oc-ghost pe-mouse"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              zIndex: 6,
              display: "flex",
              pointerEvents: "none",
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,.25))",
            }}
          >
            <MousePointer2
              size={22}
              strokeWidth={1.5}
              color="var(--card)"
              fill={OC.text}
            />
          </span>
        </>
      }
      style={style}
    >
      <div
        className="oc-in-up"
        style={{
          ...delay(200),
          height: 56,
          flexShrink: 0,
          padding: "0 30px 0 26px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Crumb>Paper</Crumb>
        <Sep />
        <Crumb>CVs</Crumb>
        <Sep />
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <FileText size={15} strokeWidth={1.7} color={OC.icon} />
          <span style={{ fontSize: 15, color: OC.text }}>
            Junior Marketing CV
          </span>
        </span>
        <Star
          size={16}
          strokeWidth={1.7}
          color={OC.icon}
          style={{ marginLeft: 8 }}
        />
        <Ellipsis
          size={16}
          strokeWidth={1.8}
          color={OC.icon}
          style={{ marginLeft: 12 }}
        />
        <div style={{ flex: 1 }} />
        <SlidersHorizontal size={15} strokeWidth={1.7} color={OC.icon} />
        <span style={{ fontSize: 15, marginLeft: -2, color: OC.secondary }}>
          Edited just now
        </span>
        <Link
          size={16}
          strokeWidth={1.7}
          color={OC.icon}
          style={{ marginLeft: 12 }}
        />
        <Bell
          size={16}
          strokeWidth={1.7}
          color={OC.icon}
          style={{ marginLeft: 11 }}
        />
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          justifyContent: "center",
          paddingTop: 24,
        }}
      >
        <div
          className="oc-pe-page"
          style={{
            width: 621,
            padding: "46px 58px",
            background: "var(--card)",
            boxShadow: "0 0 0 1px rgba(0,0,0,.025), 0 2px 8px rgba(0,0,0,.03)",
          }}
        >
          <div
            className="oc-in-up"
            style={{
              ...delay(420),
              fontSize: 26,
              lineHeight: "32px",
              fontWeight: 700,
              letterSpacing: -0.3,
            }}
          >
            Linh Nguyen
          </div>
          <div
            className="oc-in-up"
            style={{
              ...delay(460),
              marginTop: 6,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 12,
              lineHeight: "16px",
              color: OC.secondary,
            }}
          >
            <span>linh.nguyen@gmail.com</span>
            <span
              style={{ width: 1, height: 12, background: "var(--input)" }}
            />
            <span>090 123 4567</span>
            <span
              style={{ width: 1, height: 12, background: "var(--input)" }}
            />
            <span>Ho Chi Minh City</span>
          </div>

          <SectionHeading label="EXPERIENCE" d={500} first />
          <Role
            title="Marketing Intern, Lumière"
            dates="Jun 2025 to now"
            d={540}
          />
          <RetypedBullet
            i={0}
            d={580}
            first
            from="Ran 12 social campaigns and grew followers by 38% in four months."
            to="Grew Instagram followers 38% in four months across 12 beauty campaigns."
          />
          <RetypedBullet
            i={1}
            d={620}
            from="Wrote weekly TikTok scripts; three passed 100k views."
            to="Wrote weekly skincare TikTok scripts; three passed 100k views."
          />
          <Role
            title="Content Lead, Business Club"
            dates="2024 to 2025"
            d={660}
            gap={7}
          />
          <RetypedBullet
            i={2}
            d={700}
            first
            from="Wrote a weekly newsletter for 1,200 students with a 52% open rate."
            to="Grew a weekly newsletter to 1,200 readers with a 52% open rate."
          />
          <Bullet d={740}>Led a team of four writers and two designers.</Bullet>

          <SectionHeading label="EDUCATION" d={780} />
          <Role
            title="University of Economics, BBA Marketing"
            dates="2022 to 2026"
            d={820}
          />
          <Bullet d={860} first>
            GPA 3.6 / 4.0. Dean&apos;s list, 2024.
          </Bullet>

          <SectionHeading label="SKILLS" d={900} />
          <div
            className="oc-in-up"
            style={{
              ...delay(940),
              marginTop: 10,
              fontSize: 11.5,
              lineHeight: "18px",
              color: OC.body,
            }}
          >
            Canva, CapCut, Google Analytics, Meta Ads, Excel, English (IELTS
            7.5)
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export default PaperEditorAnimated
