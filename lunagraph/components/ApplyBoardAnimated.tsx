import * as React from "react";
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
  History,
  MousePointer2,
} from "lucide-react";

const C = {
  shell: "#F3F3F2",
  panel: "#FFFFFF",
  column: "#FAFAFA",
  border: "#ECECEB",
  text: "#1C1C1C",
  body: "#3A3A3A",
  muted: "#9A9A98",
  icon: "#4A4A48",
  pin: "#4F6BED",
  amber: "#E5A516",
  green: "#2F9E5A",
  indigo: "#5B63D3",
  closed: "#A9A9A7",
};

// Column pitch (271 wide + 12 gap) and the dragged card's height + gap.
const PITCH = 283;
const LIFT_SHIFT = 150;

const css = `
.oc-root * { box-sizing: border-box; }
.oc-in-left { animation: oc-fade-right .5s cubic-bezier(.22,1,.36,1) var(--d,0ms) both; }
.oc-in-up { animation: oc-fade-up .55s cubic-bezier(.22,1,.36,1) var(--d,0ms) both; }
.oc-panel { animation: oc-panel-in .6s cubic-bezier(.22,1,.36,1) 60ms both; }
@keyframes oc-fade-right { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }
@keyframes oc-fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes oc-panel-in { from { opacity: 0; transform: translateY(16px) scale(.992); } to { opacity: 1; transform: none; } }

.oc-loop { animation-duration: 8s; animation-delay: 1.8s; animation-iteration-count: infinite; animation-fill-mode: both; }
.oc-drag { animation-name: oc-drag; will-change: transform; }
.oc-shift { animation-name: oc-shift; }
.oc-cursor { animation-name: oc-cursor; }
.oc-slot { animation-name: oc-slot; }
.oc-offer-tint { animation-name: oc-offer-tint; }
.oc-int-old { animation-name: oc-int-old; }
.oc-int-new { animation-name: oc-int-new; }
.oc-off-old { animation-name: oc-off-old; }
.oc-off-new { animation-name: oc-off-new; }
.oc-pulse { animation-name: oc-pulse; }

@keyframes oc-drag {
  0%, 13% { transform: none; box-shadow: 0 1px 2px rgba(0,0,0,.03); opacity: 1; animation-timing-function: cubic-bezier(.22,1,.36,1); }
  18% { transform: translate(0,-6px) rotate(-1.5deg) scale(1.03); box-shadow: 0 18px 40px -12px rgba(0,0,0,.22), 0 4px 10px rgba(0,0,0,.06); animation-timing-function: cubic-bezier(.65,0,.35,1); }
  46% { transform: translate(${PITCH}px,-6px) rotate(1.2deg) scale(1.03); box-shadow: 0 18px 40px -12px rgba(0,0,0,.22), 0 4px 10px rgba(0,0,0,.06); animation-timing-function: cubic-bezier(.34,1.4,.64,1); }
  52%, 86% { transform: translate(${PITCH}px,0); box-shadow: 0 1px 2px rgba(0,0,0,.03); opacity: 1; }
  90% { transform: translate(${PITCH}px,0); opacity: 0; }
  90.5%, 92% { transform: none; opacity: 0; animation-timing-function: ease-out; }
  98%, 100% { transform: none; opacity: 1; }
}
@keyframes oc-shift {
  0%, 22% { transform: none; animation-timing-function: cubic-bezier(.65,0,.35,1); }
  34%, 86% { transform: translateY(-${LIFT_SHIFT}px); animation-timing-function: cubic-bezier(.65,0,.35,1); }
  92%, 100% { transform: none; }
}
@keyframes oc-cursor {
  0% { opacity: 0; transform: translate(26px,30px); animation-timing-function: cubic-bezier(.22,1,.36,1); }
  9% { opacity: 1; transform: none; }
  13% { transform: scale(.86); }
  16%, 50% { opacity: 1; transform: none; }
  52% { transform: scale(.86); }
  54% { opacity: 1; transform: none; }
  62%, 100% { opacity: 0; transform: translate(14px,16px); }
}
@keyframes oc-slot {
  0%, 20% { opacity: 0; transform: scale(.98); }
  28%, 48% { opacity: 1; transform: none; }
  53%, 100% { opacity: 0; transform: none; }
}
@keyframes oc-offer-tint {
  0%, 22% { opacity: 0; }
  32%, 50% { opacity: 1; }
  60%, 100% { opacity: 0; }
}
@keyframes oc-int-old {
  0%, 27% { opacity: 1; transform: none; }
  31%, 91% { opacity: 0; transform: translateY(-6px); }
  91.5% { opacity: 0; transform: translateY(6px); }
  96%, 100% { opacity: 1; transform: none; }
}
@keyframes oc-int-new {
  0%, 27% { opacity: 0; transform: translateY(6px); }
  31%, 91% { opacity: 1; transform: none; }
  94%, 100% { opacity: 0; transform: translateY(-6px); }
}
@keyframes oc-off-old {
  0%, 50% { opacity: 1; transform: none; }
  54%, 91% { opacity: 0; transform: translateY(-6px); }
  91.5% { opacity: 0; transform: translateY(6px); }
  96%, 100% { opacity: 1; transform: none; }
}
@keyframes oc-off-new {
  0%, 50% { opacity: 0; transform: translateY(6px); }
  54%, 91% { opacity: 1; transform: none; }
  94%, 100% { opacity: 0; transform: translateY(-6px); }
}
@keyframes oc-pulse {
  0%, 51% { transform: none; }
  55% { transform: scale(1.3); }
  61%, 100% { transform: none; }
}
.oc-static .oc-in-left, .oc-static .oc-in-up, .oc-static .oc-panel, .oc-static .oc-loop { animation: none !important; }
.oc-static .oc-cursor, .oc-static .oc-slot, .oc-static .oc-offer-tint, .oc-static .oc-int-new, .oc-static .oc-off-new { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .oc-root .oc-in-left, .oc-root .oc-in-up, .oc-root .oc-panel, .oc-root .oc-loop { animation: none !important; }
  .oc-root .oc-cursor, .oc-root .oc-slot, .oc-root .oc-offer-tint, .oc-root .oc-int-new, .oc-root .oc-off-new { opacity: 0; }
}
`;

const delay = (ms: number) => ({ ["--d" as string]: `${ms}ms` }) as React.CSSProperties;

type Status = "saved" | "applied" | "interview" | "offer" | "closed";

function StatusIcon({ status }: { status: Status }) {
  const s = 16;
  if (status === "saved")
    return (
      <svg width={s} height={s} viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6.75" fill="none" stroke="#B4B4B2" strokeWidth="1.5" />
      </svg>
    );
  if (status === "applied")
    return (
      <svg width={s} height={s} viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6.75" fill="none" stroke={C.amber} strokeWidth="1.5" />
        <path d="M8 4.25 A3.75 3.75 0 0 1 8 11.75 Z" fill={C.amber} />
      </svg>
    );
  if (status === "interview")
    return (
      <svg width={s} height={s} viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6.75" fill="none" stroke={C.green} strokeWidth="1.5" />
        <path d="M8 4.25 A3.75 3.75 0 1 1 4.25 8 L8 8 Z" fill={C.green} />
      </svg>
    );
  if (status === "offer")
    return (
      <svg width={s} height={s} viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="7.5" fill={C.indigo} />
        <path d="M5 8.2 7.1 10.2 11 6" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg width={s} height={s} viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="7.5" fill={C.closed} />
      <path d="M5.8 5.8 10.2 10.2M10.2 5.8 5.8 10.2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** The Quadrant: a 20×20 frame (stroke 2.4) on a 24 grid, with a radius-14 quarter disc from its bottom-left corner. */
function Logo() {
  return (
    <svg width={21} height={21} viewBox="2 2 20 20" fill="#1B1B1F" style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M2 2h20v20H2zM4.4 4.4v15.2h15.2V4.4z" />
      <path d="M2 8a14 14 0 0 1 14 14H2z" />
    </svg>
  );
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
          fill={i < level ? C.text : "#D3D3D1"}
        />
      ))}
    </svg>
  );
}

function NavItem({
  icon: Icon,
  label,
  meta,
  active,
  d,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  label: string;
  meta?: string;
  active?: boolean;
  d: number;
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
        background: active ? "#E7E7E5" : "transparent",
        fontSize: 15,
        color: C.text,
      }}
    >
      <Icon size={17} strokeWidth={1.7} color={C.icon} />
      <span style={{ flex: 1 }}>{label}</span>
      {meta && <span style={{ fontSize: 13, color: C.muted }}>{meta}</span>}
    </div>
  );
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
        color: C.muted,
      }}
    >
      {label}
      <ChevronDown size={11} strokeWidth={2} />
    </div>
  );
}

function Pill({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  label: string;
  active?: boolean;
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
        color: active ? C.text : C.body,
        background: active ? "#EFEFED" : "#fff",
        border: `1px solid ${active ? "#EFEFED" : "#E6E6E4"}`,
      }}
    >
      <Icon size={15} strokeWidth={1.7} color={active ? C.text : C.icon} />
      {label}
    </div>
  );
}

function CircleButton({ icon: Icon }: { icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }> }) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        border: "1px solid #E6E6E4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fff",
      }}
    >
      <Icon size={16} strokeWidth={1.7} color={C.icon} />
    </div>
  );
}

type Job = {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  title: string;
  company: string;
  level: 1 | 2 | 3;
  location: string;
  date: string;
  interview?: string;
};

function JobCard({ job, style, className, children }: { job: Job; style?: React.CSSProperties; className?: string; children?: React.ReactNode }) {
  const Icon = job.icon;
  return (
    <div
      className={className}
      style={{
        position: "relative",
        height: job.interview ? 140 : 100,
        padding: "13px 14px",
        background: "#fff",
        border: `1px solid ${C.border}`,
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
            border: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={15} strokeWidth={1.8} color={C.text} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, lineHeight: "20px", fontWeight: 500, color: C.text }}>{job.title}</div>
          <div style={{ fontSize: 13.5, lineHeight: "19px", color: "#6E6E6C" }}>{job.company}</div>
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
            background: "#F3F3F2",
            fontSize: 14,
            fontWeight: 500,
            color: C.text,
          }}
        >
          <Calendar size={14} strokeWidth={1.8} color={C.pin} />
          {job.interview}
        </div>
      )}
      <div style={{ marginLeft: 43, marginTop: job.interview ? 11 : 12, display: "flex", alignItems: "center", gap: 5 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            border: `1px solid ${C.border}`,
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
            border: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 13.5,
            color: C.body,
          }}
        >
          <MapPin size={12} strokeWidth={2} color={C.pin} />
          {job.location}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 13.5, color: C.muted }}>{job.date}</span>
      </div>
      {children}
    </div>
  );
}

function Count({ value, swapTo, outClass, inClass }: { value: string; swapTo?: string; outClass?: string; inClass?: string }) {
  if (!swapTo) return <span style={{ fontSize: 14, color: C.muted }}>{value}</span>;
  return (
    <span style={{ display: "inline-grid", fontSize: 14, color: C.muted }}>
      <span className={`oc-loop ${outClass}`} style={{ gridArea: "1 / 1" }}>{value}</span>
      <span className={`oc-loop ${inClass}`} style={{ gridArea: "1 / 1" }}>{swapTo}</span>
    </span>
  );
}

function ColumnHeader({ status, label, count }: { status: Status; label: string; count: React.ReactNode }) {
  return (
    <div style={{ height: 40, padding: "0 4px", display: "flex", alignItems: "center", gap: 9 }}>
      <span className={status === "offer" ? "oc-loop oc-pulse" : undefined} style={{ display: "flex" }}>
        <StatusIcon status={status} />
      </span>
      <span style={{ fontSize: 15, color: C.text }}>{label}</span>
      {count}
    </div>
  );
}

const saved: Job[] = [
  { icon: Gem, title: "Junior Marketing", company: "Lumière Cosmetics", level: 3, location: "HCMC", date: "Oct 25" },
  { icon: PenTool, title: "UX research intern", company: "Agency", level: 2, location: "Hanoi", date: "Oct 22" },
];
const applied: Job[] = [
  { icon: Landmark, title: "Business analyst intern", company: "Regional bank", level: 3, location: "HCMC", date: "Oct 14" },
  { icon: ShoppingBag, title: "Marketing intern", company: "E-commerce co.", level: 1, location: "Remote", date: "Oct 21" },
];
const associatePm: Job = {
  icon: Rocket,
  title: "Associate PM intern",
  company: "Local startup",
  level: 3,
  location: "Hanoi",
  date: "Oct 12",
  interview: "Interview Thu, 10:00",
};
const productAnalyst: Job = {
  icon: ShoppingBag,
  title: "Product analyst intern",
  company: "E-commerce co.",
  level: 2,
  location: "Remote",
  date: "Oct 2",
};

const columnStyle = (z: number): React.CSSProperties => ({
  position: "relative",
  zIndex: z,
  width: 271,
  flexShrink: 0,
  padding: "0 9px 9px",
  borderRadius: 10,
  background: C.column,
  display: "flex",
  flexDirection: "column",
  gap: 10,
});

export function ApplyBoardAnimated({
  animate = true,
  className,
  style,
}: {
  /** Set false to show the settled board with no motion. */
  animate?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={["oc-root", !animate && "oc-static", className].filter(Boolean).join(" ")}
      style={{
        width: 1600,
        height: 1000,
        display: "flex",
        background: C.shell,
        color: C.text,
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
        WebkitFontSmoothing: "antialiased",
        overflow: "hidden",
        ...style,
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* Sidebar */}
      <aside style={{ width: 272, flexShrink: 0, display: "flex", flexDirection: "column", paddingTop: 16 }}>
        <div className="oc-in-left" style={{ ...delay(0), height: 30, padding: "0 13px 0 18px", display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Logo />
          <span style={{ flex: 1, marginLeft: -1.5, fontSize: 17, fontWeight: 600, letterSpacing: "-0.035em", color: "#1B1B1F" }}>opencv</span>
          <Search size={18} strokeWidth={1.7} color={C.icon} />
          <div style={{ width: 30, height: 30, marginLeft: 6, borderRadius: 15, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 2px rgba(0,0,0,.06)" }}>
            <SquarePen size={16} strokeWidth={1.7} color={C.text} />
          </div>
        </div>
        <NavItem icon={Inbox} label="Inbox" meta="4" d={40} />
        <NavItem icon={MessageCircle} label="Coach" d={70} />
        <NavItem icon={Briefcase} label="Jobs" d={100} />
        <GroupLabel label="Your work" d={130} />
        <NavItem icon={FileText} label="Paper" d={160} />
        <NavItem icon={SquareKanban} label="Apply" active d={190} />
        <NavItem icon={Presentation} label="Pitch" d={220} />
        <GroupLabel label="Favorites" d={250} />
        <NavItem icon={FileText} label="Junior Marketing CV" d={280} />
        <NavItem icon={Briefcase} label="Lumière application" d={310} />
        <NavItem icon={Trophy} label="Checkout UX study" d={340} />
        <div className="oc-in-left" style={{ ...delay(380), marginTop: "auto", height: 62, padding: "0 21px 10px 18px", display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 20, height: 20, borderRadius: 10, background: "#E4E4E2", fontSize: 8, fontWeight: 600, color: "#6E6E6C", display: "flex", alignItems: "center", justifyContent: "center" }}>LN</div>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>Linh Nguyen</span>
          <Settings size={17} strokeWidth={1.7} color={C.icon} />
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: "10px 10px 0 0" }}>
        <main
          className="oc-panel"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            background: C.panel,
            borderRadius: 10,
            boxShadow: "0 0 0 1px rgba(0,0,0,.035), 0 1px 3px rgba(0,0,0,.03)",
          }}
        >
          <header style={{ height: 56, flexShrink: 0, padding: "0 26px 0 21px", display: "flex", alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ flex: 1, fontSize: 15 }}>Apply</span>
            <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 15 }}>
              <Plus size={16} strokeWidth={1.7} />
              New job
            </span>
          </header>

          <div className="oc-in-up" style={{ ...delay(220), height: 52, flexShrink: 0, padding: "0 12px", display: "flex", alignItems: "center", gap: 7 }}>
            <Pill icon={Kanban} label="Board" active />
            <Pill icon={List} label="List" />
            <Pill icon={Calendar} label="Calendar" />
            <div style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Layers size={17} strokeWidth={1.7} color={C.icon} />
            </div>
            <div style={{ flex: 1 }} />
            <CircleButton icon={Filter} />
            <CircleButton icon={SlidersHorizontal} />
          </div>

          <div style={{ flex: 1, padding: "10px 12px 13px", display: "flex", gap: 12 }}>
            {/* Saved */}
            <section className="oc-in-up" style={{ ...columnStyle(1), ...delay(300) }}>
              <ColumnHeader status="saved" label="Saved" count={<Count value="2" />} />
              {saved.map((job, i) => (
                <div key={job.title} className="oc-in-up" style={delay(460 + i * 70)}>
                  <JobCard job={job} />
                </div>
              ))}
            </section>

            {/* Applied */}
            <section className="oc-in-up" style={{ ...columnStyle(1), ...delay(360) }}>
              <ColumnHeader status="applied" label="Applied" count={<Count value="2" />} />
              {applied.map((job, i) => (
                <div key={job.title} className="oc-in-up" style={delay(520 + i * 70)}>
                  <JobCard job={job} />
                </div>
              ))}
            </section>

            {/* Interview: sits above Offer so the dragged card paints over it */}
            <section className="oc-in-up" style={{ ...columnStyle(3), ...delay(420) }}>
              <ColumnHeader
                status="interview"
                label="Interview"
                count={<Count value="2" swapTo="1" outClass="oc-int-old" inClass="oc-int-new" />}
              />
              <div className="oc-in-up" style={{ ...delay(580), position: "relative", zIndex: 2 }}>
                <JobCard job={associatePm} className="oc-loop oc-drag">
                  <span className="oc-loop oc-cursor" style={{ position: "absolute", right: 58, top: 40, display: "flex", pointerEvents: "none" }}>
                    <MousePointer2 size={22} strokeWidth={1.5} color="#fff" fill={C.text} />
                  </span>
                </JobCard>
              </div>
              <div className="oc-in-up" style={delay(650)}>
                <JobCard job={productAnalyst} className="oc-loop oc-shift" />
              </div>
            </section>

            {/* Offer */}
            <section className="oc-in-up" style={{ ...columnStyle(1), ...delay(480) }}>
              <div className="oc-loop oc-offer-tint" style={{ position: "absolute", inset: 0, borderRadius: 10, background: "#F3F3FC", pointerEvents: "none" }} />
              <div style={{ position: "relative" }}>
                <ColumnHeader
                  status="offer"
                  label="Offer"
                  count={<Count value="0" swapTo="1" outClass="oc-off-old" inClass="oc-off-new" />}
                />
              </div>
              <div
                className="oc-loop oc-slot"
                style={{ position: "absolute", top: 40, left: 9, right: 9, height: 140, borderRadius: 10, border: "1.5px dashed #C9CBEF", background: "rgba(91,99,211,.04)" }}
              />
            </section>

            {/* Hidden columns */}
            <div className="oc-in-up" style={{ ...delay(540), flex: 1, padding: "8px 0 0 9px", display: "flex", flexDirection: "column", gap: 9 }}>
              <div style={{ height: 24, padding: "0 7px", display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "#5C5C5A" }}>
                <ChevronDown size={12} strokeWidth={2} color={C.muted} />
                Hidden columns
              </div>
              <div style={{ width: 143, height: 39, padding: "0 12px", display: "flex", alignItems: "center", gap: 9, borderRadius: 9, border: `1px solid ${C.border}`, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
                <StatusIcon status="closed" />
                <span style={{ fontSize: 15 }}>Closed</span>
                <span style={{ fontSize: 14, color: C.muted }}>1</span>
              </div>
            </div>
          </div>
        </main>

        <footer className="oc-in-up" style={{ ...delay(700), height: 45, flexShrink: 0, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 25, fontSize: 14.5, color: "#6E6E6C" }}>
          <span>Tailor your CV for Lumière</span>
          <span>Prep for Local startup interview</span>
          <span style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 500, color: C.text }}>
            <MessageCircle size={16} strokeWidth={1.8} />
            Coach
          </span>
          <History size={17} strokeWidth={1.7} color={C.icon} />
        </footer>
      </div>
    </div>
  );
}

export default ApplyBoardAnimated;
