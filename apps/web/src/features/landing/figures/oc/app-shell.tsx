import * as React from "react"
import {
  Inbox,
  MessageCircle,
  Briefcase,
  FileText,
  SquareKanban,
  Presentation,
  Trophy,
  Search,
  SquarePen,
  ChevronDown,
  Settings,
  History,
} from "lucide-react"
import { OC, delay, type IconType } from "./palette.ts"
import "./app-shell.css"

/*
 * Motion conventions shared by every opencv screen:
 * - .oc-in-left / .oc-in-up: one-shot entrance, staggered with delay(ms).
 * - .oc-loop: the screen's looping demo (8s unless the screen overrides it), starts after the entrance.
 * - .oc-ghost: exists only for the demo (cursor, drop slot). Hidden in static mode and reduced motion.
 */
/** The Quadrant: a 20×20 frame (stroke 2.4) on a 24 grid, with a radius-14 quarter disc from its bottom-left corner. */
function Logo({ size = 21 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="2 2 20 20"
      fill="var(--foreground)"
      style={{ flexShrink: 0 }}
    >
      <path fillRule="evenodd" d="M2 2h20v20H2zM4.4 4.4v15.2h15.2V4.4z" />
      <path d="M2 8a14 14 0 0 1 14 14H2z" />
    </svg>
  )
}

type NavKey = "inbox" | "coach" | "jobs" | "paper" | "apply" | "pitch"

function NavItem({
  icon: Icon,
  label,
  meta,
  active,
  d,
}: {
  icon: IconType
  label: string
  meta?: string
  active?: boolean
  d: number
}) {
  return (
    <div
      className="oc-in-left"
      style={{
        ...delay(d),
        height: 32,
        margin: "0 11px",
        padding: "0 10px 0 9px",
        borderRadius: 7,
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: active ? "var(--accent)" : "transparent",
        fontSize: 15,
        color: OC.text,
      }}
    >
      <Icon size={17} strokeWidth={1.7} color={OC.icon} />
      <span style={{ flex: 1 }}>{label}</span>
      {meta && <span style={{ fontSize: 13, color: OC.muted }}>{meta}</span>}
    </div>
  )
}

function GroupLabel({ label, d }: { label: string; d: number }) {
  return (
    <div
      className="oc-in-left"
      style={{
        ...delay(d),
        height: 24,
        margin: "16px 20px 5px",
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontSize: 13.5,
        color: OC.muted,
      }}
    >
      {label}
      <ChevronDown size={11} strokeWidth={2} />
    </div>
  )
}

function Sidebar({ active }: { active: NavKey }) {
  return (
    <div
      style={{
        width: 272,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        paddingTop: 16,
      }}
    >
      <div
        className="oc-in-left"
        style={{
          ...delay(0),
          height: 30,
          padding: "0 13px 0 18px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <Logo />
        {/* Lockup: mark 1.25× type size, gap 0.38× (6.5px against the row's 8px gap). */}
        <span
          style={{
            flex: 1,
            marginLeft: -1.5,
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: "-0.035em",
            color: "var(--foreground)",
          }}
        >
          opencv
        </span>
        <Search size={18} strokeWidth={1.7} color={OC.icon} />
        <div
          style={{
            width: 30,
            height: 30,
            marginLeft: 6,
            borderRadius: 15,
            background: "var(--card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1px 2px rgba(0,0,0,.06)",
          }}
        >
          <SquarePen size={16} strokeWidth={1.7} color={OC.text} />
        </div>
      </div>
      <NavItem
        icon={Inbox}
        label="Inbox"
        meta="4"
        active={active === "inbox"}
        d={40}
      />
      <NavItem
        icon={MessageCircle}
        label="Coach"
        active={active === "coach"}
        d={70}
      />
      <NavItem
        icon={Briefcase}
        label="Jobs"
        active={active === "jobs"}
        d={100}
      />
      <GroupLabel label="Your work" d={130} />
      <NavItem
        icon={FileText}
        label="Paper"
        active={active === "paper"}
        d={160}
      />
      <NavItem
        icon={SquareKanban}
        label="Apply"
        active={active === "apply"}
        d={190}
      />
      <NavItem
        icon={Presentation}
        label="Pitch"
        active={active === "pitch"}
        d={220}
      />
      <GroupLabel label="Favorites" d={250} />
      <NavItem icon={FileText} label="Junior Marketing CV" d={280} />
      <NavItem icon={Briefcase} label="Lumière application" d={310} />
      <NavItem icon={Trophy} label="Checkout UX study" d={340} />
      <div
        className="oc-in-left"
        style={{
          ...delay(380),
          marginTop: "auto",
          height: 62,
          padding: "0 21px 10px 18px",
          display: "flex",
          alignItems: "center",
          gap: 9,
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            background: "var(--border)",
            fontSize: 8,
            fontWeight: 600,
            color: OC.secondary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          LN
        </div>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>
          Linh Nguyen
        </span>
        <Settings size={17} strokeWidth={1.7} color={OC.icon} />
      </div>
    </div>
  )
}

function BottomBar() {
  return (
    <div
      className="oc-in-up"
      style={{
        ...delay(700),
        height: 45,
        flexShrink: 0,
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 25,
        fontSize: 14.5,
        color: OC.secondary,
      }}
    >
      <span>Tailor your CV for Lumière</span>
      <span>Prep for Local startup interview</span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          fontWeight: 500,
          color: OC.text,
        }}
      >
        <MessageCircle size={16} strokeWidth={1.8} />
        Coach
      </span>
      <History size={17} strokeWidth={1.7} color={OC.icon} />
    </div>
  )
}

/**
 * The opencv app frame at 1600×1000: sidebar, white work panel, bottom suggestion bar.
 * Screens render their content as children of the panel and import their own keyframes.
 */
export function AppShell({
  active,
  animate = true,
  panelStyle,
  overlay,
  className,
  style,
  children,
}: {
  active: NavKey
  /** Set false to show the settled screen with no motion. */
  animate?: boolean
  panelStyle?: React.CSSProperties
  /**
   * Absolutely positioned layers in 1600×1000 frame coordinates (floating docks, bottom-bar states).
   * Rendered outside the panel: its entrance animation would otherwise become their containing block and clip them.
   */
  overlay?: React.ReactNode
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}) {
  return (
    <div
      className={["oc-root", !animate && "oc-static", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        position: "relative",
        width: 1600,
        height: 1000,
        display: "flex",
        background: OC.shell,
        color: OC.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
        WebkitFontSmoothing: "antialiased",
        overflow: "hidden",
        ...style,
      }}
    >
      <Sidebar active={active} />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          padding: "10px 10px 0 0",
        }}
      >
        <div
          className="oc-panel"
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            background: OC.panel,
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 0 0 1px rgba(0,0,0,.035), 0 1px 3px rgba(0,0,0,.03)",
            ...panelStyle,
          }}
        >
          {children}
        </div>
        <BottomBar />
      </div>
      {overlay}
    </div>
  )
}

export default AppShell
