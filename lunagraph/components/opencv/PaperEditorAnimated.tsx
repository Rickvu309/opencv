import * as React from "react";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Star,
  Ellipsis,
  SlidersHorizontal,
  Link,
  Bell,
  Minus,
  Maximize2,
  X,
  Copy,
  Plus,
  Leaf,
  ArrowUp,
  CircleCheck,
  Lightbulb,
  MousePointer2,
} from "lucide-react";
import { AppShell, OC, delay } from "./AppShell";

const PROMPT = "Tailor my CV for the Lumière posting";

/*
 * Loop (16s, after the entrance): the user asks Coach from the dock, Coach tailors the CV.
 *   0–9.5%   the pointer moves to the Coach button in the bottom bar and clicks it
 *   9.5–13%  the dock opens in its corner
 *   13–30%   the pointer clicks into the composer, the prompt types out, the pointer clicks send
 *   30–33%   the prompt lands as a bubble
 *   33–70%   the agent run plays out as on the Coach screen: steps spin then check, "Working" ticks up
 *   42–67%   the three bullets are backspaced and retyped; "Rewriting bullets" counts 1 → 3 of 3
 *   70–79%   the run collapses to "Worked for 12s", then the reply and the "3 changes" card land
 *   89–96%   the dock closes and the bullets return to their original text
 * Static / reduced motion shows the finished chat: dock open, "Worked for 12s", the reply and the card.
 */
const EDITS = [42, 50, 58];

/** Opacity window: hidden until `from`, shown until `to` (or the end of the loop). */
const win = (name: string, from: number, to?: number) => `
.${name} { animation-name: ${name}; }
@keyframes ${name} { 0%, ${from}% { opacity: 0; } ${from + 0.6}%, ${to ?? 100}% { opacity: 1; }${to === undefined ? "" : ` ${to + 0.6}%, 100% { opacity: 0; }`} }`;

/** Chat entrance: fades up at `at`, holds, and clears as the dock closes. */
const rise = (name: string, at: number, dur = 2) => `
.${name} { animation-name: ${name}; }
@keyframes ${name} {
  0%, ${at}% { opacity: 0; transform: translateY(6px); animation-timing-function: cubic-bezier(.22,1,.36,1); }
  ${at + dur}%, 89% { opacity: 1; transform: none; }
  93%, 100% { opacity: 0; transform: none; }
}`;

const bulletCss = EDITS.map(
  (s, i) => `
.pe-old${i} { animation-name: pe-old${i}; }
@keyframes pe-old${i} {
  0%, ${s + 1}% { max-width: 520px; opacity: 1; animation-timing-function: steps(30, end); }
  ${s + 3.5}%, 92% { max-width: 0; opacity: 1; }
  92.5% { max-width: 520px; opacity: 0; animation-timing-function: ease-out; }
  96%, 100% { max-width: 520px; opacity: 1; }
}
.pe-new${i} { animation-name: pe-new${i}; }
@keyframes pe-new${i} {
  0%, ${s + 4}% { max-width: 0; opacity: 1; animation-timing-function: steps(34, end); }
  ${s + 8.5}%, 88% { max-width: 520px; opacity: 1; animation-timing-function: ease-out; }
  92% { max-width: 520px; opacity: 0; }
  92.5%, 100% { max-width: 0; opacity: 1; }
}`,
).join("\n");

// Pointer targets in frame coordinates, offset so the arrow tip lands on the target.
const TIP = 4;
const AT = {
  start: [1262 - TIP, 742 - TIP],
  coach: [1497 - TIP, 977 - TIP],
  composer: [1184 - TIP, 871 - TIP],
  send: [1541 - TIP, 908 - TIP],
};
const at = ([x, y]: number[], s = 1) => `translate(${x}px, ${y}px)${s === 1 ? "" : ` scale(${s})`}`;

const pointerCss = `
.pe-mouse { animation-name: pe-mouse; transform-origin: 0 0; }
@keyframes pe-mouse {
  0% { opacity: 0; transform: ${at(AT.start)}; }
  1.5% { opacity: 1; transform: ${at(AT.start)}; animation-timing-function: cubic-bezier(.45,0,.2,1); }
  7.5% { transform: ${at(AT.coach)}; }
  8.5% { transform: ${at(AT.coach, 0.86)}; }
  9.5%, 13% { transform: ${at(AT.coach)}; animation-timing-function: cubic-bezier(.45,0,.2,1); }
  17% { transform: ${at(AT.composer)}; }
  17.8% { transform: ${at(AT.composer, 0.86)}; }
  18.5%, 26% { transform: ${at(AT.composer)}; animation-timing-function: cubic-bezier(.45,0,.2,1); }
  29% { transform: ${at(AT.send)}; }
  29.8% { transform: ${at(AT.send, 0.86)}; }
  30.5%, 31% { opacity: 1; transform: ${at(AT.send)}; animation-timing-function: ease-out; }
  34%, 100% { opacity: 0; transform: ${at([AT.send[0] + 14, AT.send[1] + 16])}; }
}`;

const runCss = [
  `.pe-dock { animation-name: pe-dock; transform-origin: 75% 100%; }
@keyframes pe-dock {
  0%, 9.5% { opacity: 0; transform: translateY(10px) scale(.98); animation-timing-function: cubic-bezier(.22,1,.36,1); }
  13%, 89% { opacity: 1; transform: none; animation-timing-function: ease-in; }
  93%, 100% { opacity: 0; transform: translateY(10px) scale(.98); }
}`,
  win("pe-coachpill", 9, 91),
  // Composer: placeholder gives way to the typed prompt, send turns dark, then it clears on send.
  `.pe-ph { animation-name: pe-ph; }
@keyframes pe-ph { 0%, 17.9% { opacity: 1; } 18%, 30% { opacity: 0; } 30.1%, 100% { opacity: 1; } }`,
  `.pe-typed { animation-name: pe-typed; }
@keyframes pe-typed {
  0%, 18% { opacity: 1; max-width: 0; animation-timing-function: steps(36, end); }
  26%, 30% { opacity: 1; max-width: 262px; }
  30.1%, 100% { opacity: 0; max-width: 262px; }
}`,
  win("pe-tcaret", 17.8, 30),
  win("pe-send", 18.5, 30),
  rise("pe-ask", 30, 2.5),
  rise("pe-wk", 33),
  win("pe-t2", 33.5, 38),
  win("pe-t4", 38, 46),
  win("pe-t7", 46, 54),
  win("pe-t9", 54, 62),
  win("pe-t12", 62, 70.5),
  win("pe-tdone", 70.5),
  `.pe-steps { animation-name: pe-steps; }
@keyframes pe-steps { 0%, 33% { opacity: 0; } 34%, 70% { opacity: 1; } 71.5%, 100% { opacity: 0; } }`,
  rise("pe-r1", 33.5),
  rise("pe-r2", 37.5),
  rise("pe-r3", 41.5),
  rise("pe-r4", 42),
  win("pe-s1", 33.5, 37),
  win("pe-k1", 37),
  win("pe-s2", 37.5, 41),
  win("pe-k2", 41),
  win("pe-s3", 41.5, 67),
  win("pe-k3", 67),
  `.pe-p4 { animation-name: pe-p4; }
@keyframes pe-p4 { 0%, 67% { opacity: 1; } 67.6%, 100% { opacity: 0; } }`,
  win("pe-s4", 67, 69.5),
  win("pe-k4", 69.5),
  win("pe-m1", 41.5, 50),
  win("pe-m2", 50, 58),
  win("pe-m3", 58),
  `.pe-l4 { animation-name: pe-l4; }
@keyframes pe-l4 { 0%, 67% { color: ${OC.muted}; font-weight: 400; } 68%, 100% { color: ${OC.text}; font-weight: 500; } }`,
  rise("pe-done", 71, 2.5),
  rise("pe-card", 73.5, 3.5),
  win("pe-copy", 76.5, 89),
].join("\n");

const css = `
.oc-root .oc-loop { animation-duration: 16s; }
.oc-pe-page { animation: oc-pe-rise .7s cubic-bezier(.22,1,.36,1) 260ms both; }
@keyframes oc-pe-rise { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: none; } }
.pe-spin { animation: pe-spin .9s linear infinite; }
@keyframes pe-spin { to { transform: rotate(360deg); } }
.pe-blink { animation: pe-blink 1s steps(1, end) infinite; }
@keyframes pe-blink { 50% { opacity: 0; } }
.pe-shimmer { background: linear-gradient(90deg, #EDEDEC 0%, #EDEDEC 35%, #F7F7F6 50%, #EDEDEC 65%, #EDEDEC 100%); background-size: 300% 100%; animation: pe-shimmer 1.8s linear infinite; }
@keyframes pe-shimmer { from { background-position: 100% 0; } to { background-position: 0% 0; } }
.oc-static .oc-pe-page, .oc-static .pe-spin, .oc-static .pe-blink, .oc-static .pe-shimmer { animation: none !important; }
@media (prefers-reduced-motion: reduce) { .oc-root .oc-pe-page, .oc-root .pe-spin, .oc-root .pe-blink, .oc-root .pe-shimmer { animation: none !important; } }
${pointerCss}
${runCss}
${bulletCss}
`;

function Crumb({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 15, color: OC.body }}>{children}</span>;
}

function Sep() {
  return <ChevronRight size={14} strokeWidth={1.8} color={OC.muted} />;
}

function SectionHeading({ label, d, first }: { label: string; d: number; first?: boolean }) {
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
  );
}

function Role({ title, dates, d, gap = 9 }: { title: string; dates: string; d: number; gap?: number }) {
  return (
    <div className="oc-in-up" style={{ ...delay(d), marginTop: gap, display: "flex", alignItems: "baseline", lineHeight: "18px" }}>
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: OC.text }}>{title}</span>
      <span style={{ fontSize: 11.5, color: OC.muted }}>{dates}</span>
    </div>
  );
}

function Bullet({ d, first, children }: { d: number; first?: boolean; children: React.ReactNode }) {
  return (
    <div
      className="oc-in-up"
      style={{ ...delay(d), position: "relative", marginTop: first ? 2 : 0, paddingLeft: 14, fontSize: 11.5, lineHeight: "22px", color: OC.body }}
    >
      <span style={{ position: "absolute", left: 3, top: 9.5, width: 3.5, height: 3.5, borderRadius: 2, background: OC.icon }} />
      {children}
    </div>
  );
}

const clip: React.CSSProperties = { display: "inline-block", overflow: "hidden", whiteSpace: "nowrap" };

/** A bullet Coach retypes: the old line backspaces away, then the new one types in. */
function RetypedBullet({ i, d, first, from, to }: { i: number; d: number; first?: boolean; from: string; to: string }) {
  return (
    <Bullet d={d} first={first}>
      <span style={{ display: "inline-flex", alignItems: "center", verticalAlign: "top" }}>
        <span className={`oc-loop pe-old${i}`} style={{ ...clip, maxWidth: 520 }}>{from}</span>
        <span className={`oc-loop pe-new${i}`} style={{ ...clip, maxWidth: 0 }}>{to}</span>
      </span>
    </Bullet>
  );
}

const stack: React.CSSProperties = { gridArea: "1 / 1", display: "flex", alignItems: "center", justifyContent: "center" };

function Spinner({ className }: { className: string }) {
  return (
    <span className={`oc-loop ${className}`} style={{ ...stack, opacity: 0 }}>
      <svg className="pe-spin" width={16} height={16} viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="7" fill="none" stroke={OC.orange} strokeWidth="1.8" strokeLinecap="round" strokeDasharray="30 44" />
      </svg>
    </span>
  );
}

function Check({ className }: { className: string }) {
  return (
    <span className={`oc-loop ${className}`} style={stack}>
      <CircleCheck size={16} strokeWidth={1.8} color={OC.text} />
    </span>
  );
}

function Pending({ className }: { className: string }) {
  return (
    <span className={`oc-loop ${className}`} style={{ ...stack, opacity: 0 }}>
      <svg width={16} height={16} viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="7.25" fill="none" stroke="#CDCDCB" strokeWidth="1.5" />
      </svg>
    </span>
  );
}

function Step({ className, icon, label, labelClass, meta }: { className: string; icon: React.ReactNode; label: string; labelClass?: string; meta?: React.ReactNode }) {
  return (
    <div className={`oc-loop ${className}`} style={{ height: 28, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 16, height: 16, display: "grid", flexShrink: 0 }}>{icon}</span>
      <span className={labelClass ? `oc-loop ${labelClass}` : undefined} style={{ fontSize: 13.5, fontWeight: 500, color: OC.text, whiteSpace: "nowrap" }}>
        {label}
      </span>
      {meta && <span style={{ fontSize: 13, color: OC.muted, whiteSpace: "nowrap" }}>{meta}</span>}
    </div>
  );
}

/** Stacked crossfade values; only the one marked `settled` shows in the static frame. */
function Ticker({ items }: { items: { className: string; text: string; settled?: boolean }[] }) {
  return (
    <span style={{ display: "inline-grid" }}>
      {items.map((t) => (
        <span key={t.className} className={`oc-loop ${t.className}`} style={{ gridArea: "1 / 1", opacity: t.settled ? 1 : 0, whiteSpace: "nowrap" }}>
          {t.text}
        </span>
      ))}
    </span>
  );
}

function IconButton({ children }: { children: React.ReactNode }) {
  return <span style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</span>;
}

function CoachDock() {
  return (
    <div
      className="oc-loop pe-dock"
      style={{
        position: "absolute",
        left: 1134,
        top: 281,
        width: 444,
        height: 665,
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        borderRadius: 13,
        border: "1px solid #E5E5E3",
        boxShadow: "0 24px 56px -12px rgba(0,0,0,.14), 0 2px 8px rgba(0,0,0,.04)",
        zIndex: 5,
      }}
    >
      <div style={{ height: 53, flexShrink: 0, padding: "0 13px 0 18px", display: "flex", alignItems: "center", borderBottom: "1px solid #EDEDEB" }}>
        <span style={{ fontSize: 14.5, color: OC.text }}>Tailor CV for Lumière</span>
        <ChevronDown size={12} strokeWidth={1.8} color={OC.muted} style={{ marginLeft: 8 }} />
        <span style={{ flex: 1 }} />
        <IconButton><Minus size={16} strokeWidth={1.6} color={OC.icon} /></IconButton>
        <span style={{ width: 9 }} />
        <IconButton><Maximize2 size={15} strokeWidth={1.6} color={OC.icon} /></IconButton>
        <span style={{ width: 9 }} />
        <IconButton><X size={16} strokeWidth={1.6} color={OC.icon} /></IconButton>
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: "0 17px 0 18px", display: "flex", flexDirection: "column" }}>
        <div style={{ marginTop: 16, textAlign: "center", fontSize: 12.5, lineHeight: "16px", color: OC.muted }}>Today 9:41</div>
        <div
          className="oc-loop pe-ask"
          style={{ alignSelf: "flex-end", marginTop: 15, height: 35, padding: "0 14px", borderRadius: 18, background: "#F1F1F0", display: "flex", alignItems: "center", fontSize: 14, color: OC.text }}
        >
          {PROMPT}
        </div>

        <div className="oc-loop pe-wk" style={{ marginTop: 18, height: 20, display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, color: OC.muted }}>
          <Lightbulb size={14} strokeWidth={1.7} color={OC.muted} />
          <Ticker
            items={[
              { className: "pe-t2", text: "Working, 2s" },
              { className: "pe-t4", text: "Working, 4s" },
              { className: "pe-t7", text: "Working, 7s" },
              { className: "pe-t9", text: "Working, 9s" },
              { className: "pe-t12", text: "Working, 12s" },
              { className: "pe-tdone", text: "Worked for 12s", settled: true },
            ]}
          />
          <ChevronDown size={12} strokeWidth={1.8} color={OC.muted} />
        </div>

        <div style={{ marginTop: 10, display: "grid" }}>
          {/* The run: same step language as the Coach screen. Hidden once it collapses, and in the static frame. */}
          <div className="oc-loop pe-steps" style={{ gridArea: "1 / 1", opacity: 0, position: "relative", paddingLeft: 16 }}>
            <span style={{ position: "absolute", left: 1, top: 4, bottom: 52, width: 1.5, borderRadius: 1, background: "#E6E6E4" }} />
            <Step className="pe-r1" icon={<><Spinner className="pe-s1" /><Check className="pe-k1" /></>} label="Read Junior Marketing CV" meta="2 roles, 6 bullets" />
            <Step className="pe-r2" icon={<><Spinner className="pe-s2" /><Check className="pe-k2" /></>} label="Read the Lumière posting" meta="Junior Marketing, HCMC" />
            <Step
              className="pe-r3"
              icon={<><Spinner className="pe-s3" /><Check className="pe-k3" /></>}
              label="Rewriting bullets"
              meta={<Ticker items={[{ className: "pe-m1", text: "1 of 3" }, { className: "pe-m2", text: "2 of 3" }, { className: "pe-m3", text: "3 of 3", settled: true }]} />}
            />
            <Step
              className="pe-r4"
              icon={<><Pending className="pe-p4" /><Spinner className="pe-s4" /><Check className="pe-k4" /></>}
              label="Check it still fits one page"
              labelClass="pe-l4"
            />
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 9 }}>
              <div className="pe-shimmer" style={{ width: 340, height: 8, borderRadius: 4 }} />
              <div className="pe-shimmer" style={{ width: 300, height: 8, borderRadius: 4 }} />
              <div className="pe-shimmer" style={{ width: 190, height: 8, borderRadius: 4 }} />
            </div>
          </div>

          <div style={{ gridArea: "1 / 1", display: "flex", flexDirection: "column" }}>
            <div className="oc-loop pe-done" style={{ fontSize: 14, lineHeight: "20px", color: OC.text }}>
              Done. I rewrote 3 bullets to match what Lumière asks for.
            </div>

            <div
              className="oc-loop pe-card"
              style={{ marginTop: 16, height: 56, padding: "0 14px 0 13px", borderRadius: 14, border: "1px solid #E6E6E4", display: "flex", alignItems: "center", gap: 11 }}
            >
              <span style={{ width: 29, height: 29, borderRadius: 7, background: OC.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileText size={15} strokeWidth={1.8} color="#fff" />
              </span>
              <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 13.5, lineHeight: "17px", fontWeight: 500, color: OC.text }}>Junior Marketing CV</span>
                <span style={{ fontSize: 12.5, lineHeight: "17px", color: OC.muted }}>3 changes</span>
              </span>
              <span
                style={{
                  height: 26,
                  padding: "0 10px",
                  borderRadius: 6,
                  background: "linear-gradient(180deg, #E9EBFC 0%, #DFE2FA 100%)",
                  boxShadow: "0 2px 8px rgba(99,102,241,.22)",
                  display: "flex",
                  alignItems: "center",
                  fontSize: 13,
                  fontWeight: 500,
                  color: OC.text,
                }}
              >
                Open
              </span>
            </div>
            <span className="oc-loop pe-copy" style={{ marginTop: 15, display: "flex" }}>
              <Copy size={14} strokeWidth={1.6} color={OC.muted} />
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          margin: "0 8px 8px",
          height: 87,
          padding: "11px 13px 12px 13px",
          borderRadius: 18,
          border: "1px solid #E5E5E3",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "grid", paddingLeft: 1, fontSize: 14, lineHeight: "20px" }}>
          <span className="oc-loop pe-ph" style={{ gridArea: "1 / 1", color: OC.muted }}>Reply...</span>
          <span style={{ gridArea: "1 / 1", display: "flex", alignItems: "center" }}>
            <span className="oc-loop pe-typed" style={{ ...clip, maxWidth: 0, color: OC.text }}>{PROMPT}</span>
            <span className="oc-loop pe-tcaret" style={{ display: "flex", opacity: 0 }}>
              <span className="pe-blink" style={{ width: 1.5, height: 17, background: OC.text }} />
            </span>
          </span>
        </div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center" }}>
          <span style={{ width: 31, height: 31, borderRadius: 16, border: "1px solid #E5E5E3", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Plus size={15} strokeWidth={1.7} color={OC.text} />
          </span>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: OC.body }}>
            <Leaf size={14} strokeWidth={1.6} color={OC.icon} />
            Free
            <ChevronDown size={11} strokeWidth={1.8} color={OC.muted} style={{ marginLeft: 2 }} />
          </span>
          <span style={{ marginLeft: 16, display: "grid" }}>
            <span style={{ gridArea: "1 / 1", width: 31, height: 31, borderRadius: 16, background: "#E9E9E8", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArrowUp size={15} strokeWidth={1.8} color="#A3A3A1" />
            </span>
            {/* Ready to send once there's text. */}
            <span className="oc-loop pe-send" style={{ gridArea: "1 / 1", opacity: 0, width: 31, height: 31, borderRadius: 16, background: OC.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArrowUp size={15} strokeWidth={2} color="#fff" />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function PaperEditorAnimated({
  animate = true,
  className,
  style,
}: {
  /** Set false to show the settled screen with no motion. */
  animate?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <AppShell
      active="paper"
      animate={animate}
      css={css}
      panelStyle={{ background: "#F7F7F6" }}
      overlay={
        <>
          {/* The Coach button's open state. */}
          <span
            className="oc-loop pe-coachpill"
            style={{ position: "absolute", left: 1453, top: 960, width: 88, height: 34, borderRadius: 8, background: "rgba(0,0,0,.06)", pointerEvents: "none" }}
          />
          <CoachDock />
          <span className="oc-loop oc-ghost pe-mouse" style={{ position: "absolute", left: 0, top: 0, zIndex: 6, display: "flex", pointerEvents: "none", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.25))" }}>
            <MousePointer2 size={22} strokeWidth={1.5} color="#fff" fill={OC.text} />
          </span>
        </>
      }
      className={className}
      style={style}
    >
      <header
        className="oc-in-up"
        style={{ ...delay(200), height: 56, flexShrink: 0, padding: "0 30px 0 26px", display: "flex", alignItems: "center", gap: 10 }}
      >
        <Crumb>Paper</Crumb>
        <Sep />
        <Crumb>CVs</Crumb>
        <Sep />
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <FileText size={15} strokeWidth={1.7} color={OC.icon} />
          <span style={{ fontSize: 15, color: OC.text }}>Junior Marketing CV</span>
        </span>
        <Star size={16} strokeWidth={1.7} color={OC.icon} style={{ marginLeft: 8 }} />
        <Ellipsis size={16} strokeWidth={1.8} color={OC.icon} style={{ marginLeft: 12 }} />
        <div style={{ flex: 1 }} />
        <SlidersHorizontal size={15} strokeWidth={1.7} color={OC.icon} />
        <span style={{ fontSize: 15, marginLeft: -2, color: OC.secondary }}>Edited just now</span>
        <Link size={16} strokeWidth={1.7} color={OC.icon} style={{ marginLeft: 12 }} />
        <Bell size={16} strokeWidth={1.7} color={OC.icon} style={{ marginLeft: 11 }} />
      </header>

      <div style={{ flex: 1, minHeight: 0, display: "flex", justifyContent: "center", paddingTop: 24 }}>
        <article
          className="oc-pe-page"
          style={{
            width: 621,
            padding: "46px 58px",
            background: "#fff",
            boxShadow: "0 0 0 1px rgba(0,0,0,.025), 0 2px 8px rgba(0,0,0,.03)",
          }}
        >
          <div className="oc-in-up" style={{ ...delay(420), fontSize: 26, lineHeight: "32px", fontWeight: 700, letterSpacing: -0.3 }}>
            Linh Nguyen
          </div>
          <div
            className="oc-in-up"
            style={{ ...delay(460), marginTop: 6, display: "flex", alignItems: "center", gap: 10, fontSize: 12, lineHeight: "16px", color: OC.secondary }}
          >
            <span>linh.nguyen@gmail.com</span>
            <span style={{ width: 1, height: 12, background: "#D6D6D4" }} />
            <span>090 123 4567</span>
            <span style={{ width: 1, height: 12, background: "#D6D6D4" }} />
            <span>Ho Chi Minh City</span>
          </div>

          <SectionHeading label="EXPERIENCE" d={500} first />
          <Role title="Marketing Intern, Lumière" dates="Jun 2025 to now" d={540} />
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
          <Role title="Content Lead, Business Club" dates="2024 to 2025" d={660} gap={7} />
          <RetypedBullet
            i={2}
            d={700}
            first
            from="Wrote a weekly newsletter for 1,200 students with a 52% open rate."
            to="Grew a weekly newsletter to 1,200 readers with a 52% open rate."
          />
          <Bullet d={740}>Led a team of four writers and two designers.</Bullet>

          <SectionHeading label="EDUCATION" d={780} />
          <Role title="University of Economics, BBA Marketing" dates="2022 to 2026" d={820} />
          <Bullet d={860} first>
            GPA 3.6 / 4.0. Dean&apos;s list, 2024.
          </Bullet>

          <SectionHeading label="SKILLS" d={900} />
          <div className="oc-in-up" style={{ ...delay(940), marginTop: 10, fontSize: 11.5, lineHeight: "18px", color: OC.body }}>
            Canva, CapCut, Google Analytics, Meta Ads, Excel, English (IELTS 7.5)
          </div>
        </article>
      </div>
    </AppShell>
  );
}

export default PaperEditorAnimated;
