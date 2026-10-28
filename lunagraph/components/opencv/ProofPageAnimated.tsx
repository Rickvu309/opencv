import * as React from "react";
import { ChevronRight, ArrowRight, Play, FileText, CircleCheck } from "lucide-react";
import { AppShell, OC, delay } from "./AppShell";

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
  [132, 516], [192, 509], [249, 509], [312, 495], [375, 472], [429, 456], [488, 411], [545, 389],
  [607, 373], [665, 329], [725, 307], [785, 277], [844, 247], [905, 219], [965, 191], [1023, 164],
];
const START = LINE[0];
const END = LINE[LINE.length - 1];
const MARKS = [
  { at: [488, 411], label: "142k", t: 20 },
  { at: [665, 329], label: "118k", t: 28 },
  { at: [844, 247], label: "205k", t: 37 },
] as const;

const linePath = "M" + LINE.map(([x, y]) => `${x} ${y}`).join(" L");
const areaPath = `${linePath} L${END[0]} 616 L${START[0]} 616 Z`;

const pop = (name: string, t: number) => `
@keyframes ${name} {
  0%, ${t}% { opacity: 0; transform: scale(.3); animation-timing-function: cubic-bezier(.34,1.56,.64,1); }
  ${t + 3}%, 88% { opacity: 1; transform: none; }
  94%, 100% { opacity: 0; transform: none; }
}`;
const rise = (name: string, t: number) => `
@keyframes ${name} {
  0%, ${t}% { opacity: 0; transform: translateY(6px) scale(.96); animation-timing-function: cubic-bezier(.22,1,.36,1); }
  ${t + 4}%, 88% { opacity: 1; transform: none; }
  94%, 100% { opacity: 0; transform: none; }
}`;

const css = `
.pp-svg-pop { transform-box: fill-box; transform-origin: center; }
.pp-line { stroke-dasharray: 1 1.01; animation-name: pp-line; }
@keyframes pp-line {
  0%, 2% { stroke-dashoffset: 1; opacity: 1; animation-timing-function: linear; }
  46%, 88% { stroke-dashoffset: 0; opacity: 1; }
  94%, 100% { stroke-dashoffset: 0; opacity: 0; }
}
.pp-area { animation-name: pp-area; }
@keyframes pp-area { 0%, 10% { opacity: 0; } 50%, 88% { opacity: 1; } 94%, 100% { opacity: 0; } }

.pp-pt0 { animation-name: pp-pt0; } ${pop("pp-pt0", 2)}
.pp-pt1 { animation-name: pp-pt1; } ${pop("pp-pt1", 20)}
.pp-pt2 { animation-name: pp-pt2; } ${pop("pp-pt2", 28)}
.pp-pt3 { animation-name: pp-pt3; } ${pop("pp-pt3", 37)}
.pp-end { animation-name: pp-end; } ${pop("pp-end", 46)}
.pp-lb1 { animation-name: pp-lb1; } ${rise("pp-lb1", 21)}
.pp-lb2 { animation-name: pp-lb2; } ${rise("pp-lb2", 29)}
.pp-lb3 { animation-name: pp-lb3; } ${rise("pp-lb3", 38)}

.pp-halo { animation-name: pp-halo; }
@keyframes pp-halo { 0%, 47% { opacity: 0; transform: scale(.4); } 52%, 88% { opacity: 1; transform: none; } 94%, 100% { opacity: 0; transform: none; } }
.pp-ring { animation-name: pp-ring; }
@keyframes pp-ring { 0%, 48% { opacity: 0; transform: scale(.5); } 50% { opacity: .5; } 62%, 100% { opacity: 0; transform: scale(2.2); } }

.pp-conn { transform-origin: bottom; animation-name: pp-conn; }
@keyframes pp-conn { 0%, 50% { transform: scaleY(0); opacity: 1; animation-timing-function: cubic-bezier(.22,1,.36,1); } 55%, 88% { transform: none; opacity: 1; } 94%, 100% { transform: none; opacity: 0; } }
.pp-pill { animation-name: pp-pill; }
@keyframes pp-pill { 0%, 52% { opacity: 0; transform: translateY(-10px); animation-timing-function: cubic-bezier(.22,1,.36,1); } 57%, 88% { opacity: 1; transform: none; } 94%, 100% { opacity: 0; transform: none; } }
.pp-check { animation-name: pp-check; }
@keyframes pp-check { 0%, 57% { opacity: 0; transform: scale(.4); animation-timing-function: cubic-bezier(.34,1.56,.64,1); } 61%, 100% { opacity: 1; transform: none; } }

.pp-chip { animation-name: pp-chip; }
@keyframes pp-chip {
  0%, 62% { transform: none; box-shadow: 0 0 0 0 rgba(28,28,28,0); }
  65% { transform: scale(1.12); box-shadow: 0 0 0 5px rgba(28,28,28,.12); }
  71%, 100% { transform: none; box-shadow: 0 0 0 0 rgba(28,28,28,0); }
}

.pp-c0 { animation-name: pp-c0; } .pp-c12 { animation-name: pp-c12; } .pp-c27 { animation-name: pp-c27; } .pp-c38 { animation-name: pp-c38; }
@keyframes pp-c0 { 0%, 11% { opacity: 1; transform: none; } 13%, 94% { opacity: 0; transform: translateY(-10px); } 97%, 100% { opacity: 1; transform: none; } }
@keyframes pp-c12 { 0%, 11% { opacity: 0; transform: translateY(10px); } 13%, 23% { opacity: 1; transform: none; } 25%, 100% { opacity: 0; transform: translateY(-10px); } }
@keyframes pp-c27 { 0%, 23% { opacity: 0; transform: translateY(10px); } 25%, 36% { opacity: 1; transform: none; } 38%, 100% { opacity: 0; transform: translateY(-10px); } }
@keyframes pp-c38 { 0%, 36% { opacity: 0; transform: translateY(10px); } 38%, 92% { opacity: 1; transform: none; } 95%, 100% { opacity: 0; transform: translateY(-10px); } }
`;

const counterStyle = (visible: boolean): React.CSSProperties => ({ gridArea: "1 / 1", opacity: visible ? 1 : 0 });

function ChartLabel({ x, y, label, className }: { x: number; y: number; label: string; className: string }) {
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
        background: "#fff",
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
  );
}

export function ProofPageAnimated({
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
    <AppShell active="paper" animate={animate} css={css} className={className} style={style}>
      <header
        className="oc-in-up"
        style={{ ...delay(150), height: 52, flexShrink: 0, padding: "0 22px", display: "flex", alignItems: "center", gap: 10, background: "#FAFAF9", borderBottom: "1px solid #F1F1F0", fontSize: 15.5 }}
      >
        <span style={{ color: OC.secondary }}>Paper</span>
        <ChevronRight size={14} strokeWidth={1.8} color={OC.muted} />
        <span style={{ fontWeight: 500 }}>Proofs</span>
      </header>

      <div style={{ flex: 1, minHeight: 0, padding: "48px 82px 0 70px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <div
              className="oc-in-up"
              style={{ ...delay(220), display: "inline-flex", alignItems: "center", gap: 7, height: 28, padding: "0 12px 0 11px", borderRadius: 14, border: `1px solid ${OC.border}`, background: "#fff", fontSize: 14, color: OC.secondary }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 3, background: "#B4B4B2" }} />
              Coming soon
            </div>
            <h1
              className="oc-in-up"
              style={{ ...delay(280), margin: "16px 0 0", fontSize: 58, lineHeight: "66px", fontWeight: 700, letterSpacing: -2, color: OC.text }}
            >
              Back your CV with proof
            </h1>
            <p className="oc-in-up" style={{ ...delay(340), margin: "10px 0 0", fontSize: 18.5, lineHeight: "26px", color: OC.secondary }}>
              Turn a CV line into evidence.
            </p>
          </div>
          <div
            className="oc-in-up"
            style={{ ...delay(360), marginBottom: 4, height: 43, padding: "0 16px 0 18px", display: "flex", alignItems: "center", gap: 9, borderRadius: 9, background: OC.text, color: "#fff", fontSize: 16.5, fontWeight: 600 }}
          >
            Get early access
            <ArrowRight size={16} strokeWidth={2} color="#fff" />
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
            border: "1px solid #EDEDEC",
            background: "linear-gradient(180deg, #FBFBFA 0%, #F4F4F3 100%)",
            overflow: "hidden",
          }}
        >
          <svg width={1166} height={616} viewBox="0 0 1166 616" style={{ position: "absolute", inset: 0 }}>
            <defs>
              <linearGradient id="pp-area-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#000" stopOpacity="0.055" />
                <stop offset="100%" stopColor="#000" stopOpacity="0.015" />
              </linearGradient>
            </defs>
            <g stroke="#000" strokeOpacity="0.045" strokeWidth="1">
              {Array.from({ length: 10 }, (_, i) => (
                <line key={`v${i}`} x1={107 * (i + 1)} y1={0} x2={107 * (i + 1)} y2={616} />
              ))}
              {[205, 410].map((y) => (
                <line key={`h${y}`} x1={0} y1={y} x2={1166} y2={y} />
              ))}
            </g>

            <path className="oc-loop pp-area" d={areaPath} fill="url(#pp-area-fill)" />
            <path
              className="oc-loop pp-line"
              d={linePath}
              pathLength={1}
              fill="none"
              stroke={OC.text}
              strokeWidth={2.4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            <line x1={START[0]} y1={START[1] + 8} x2={START[0]} y2={539} stroke="#C9C9C7" strokeWidth={1.2} />

            <circle className="oc-loop pp-svg-pop pp-pt0" cx={START[0]} cy={START[1]} r={6.5} fill="#fff" stroke={OC.text} strokeWidth={2.2} />
            {MARKS.map((m, i) => (
              <circle
                key={m.label}
                className={`oc-loop pp-svg-pop pp-pt${i + 1}`}
                cx={m.at[0]}
                cy={m.at[1]}
                r={6.5}
                fill="#fff"
                stroke={OC.text}
                strokeWidth={2.2}
              />
            ))}

            <circle className="oc-loop oc-ghost pp-svg-pop pp-ring" cx={END[0]} cy={END[1]} r={21} fill="none" stroke={OC.text} strokeWidth={1.5} style={{ opacity: 0 }} />
            <circle className="oc-loop pp-svg-pop pp-halo" cx={END[0]} cy={END[1]} r={21} fill="#000" fillOpacity={0.08} />
            <circle className="oc-loop pp-svg-pop pp-end" cx={END[0]} cy={END[1]} r={8.5} fill={OC.text} />
          </svg>

          <div style={{ position: "absolute", left: 61, top: 46 }}>
            <div style={{ display: "inline-grid", fontSize: 150, lineHeight: "150px", fontWeight: 700, letterSpacing: -4, color: OC.text }}>
              <span className="oc-loop pp-c0" style={counterStyle(false)}>+0%</span>
              <span className="oc-loop pp-c12" style={counterStyle(false)}>+12%</span>
              <span className="oc-loop pp-c27" style={counterStyle(false)}>+27%</span>
              <span className="oc-loop pp-c38" style={counterStyle(true)}>+38%</span>
            </div>
            <div style={{ marginTop: 12, marginLeft: 4, fontSize: 18.5, color: "#8A8A88" }}>followers</div>
          </div>

          {MARKS.map((m, i) => (
            <ChartLabel key={m.label} x={m.at[0]} y={m.at[1]} label={m.label} className={`pp-lb${i + 1}`} />
          ))}

          <div className="oc-loop pp-conn" style={{ position: "absolute", left: END[0] - 0.6, top: 103, width: 1.2, height: END[1] - 103 - 21, background: "#C9C9C7" }} />
          <div
            className="oc-loop pp-pill"
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
              background: "#fff",
              boxShadow: "0 0 0 1px rgba(0,0,0,.04), 0 6px 18px rgba(0,0,0,.07)",
            }}
          >
            <span style={{ width: 34, height: 34, borderRadius: 17, background: "#EEEEED", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: OC.secondary }}>
              NA
            </span>
            <span style={{ fontSize: 15.5, fontWeight: 600, color: OC.text }}>Manager confirmed</span>
            <span className="oc-loop pp-check" style={{ display: "flex" }}>
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
              background: "#fff",
              boxShadow: "0 0 0 1px rgba(0,0,0,.04), 0 4px 14px rgba(0,0,0,.06)",
              fontSize: 16.5,
              color: OC.body,
              whiteSpace: "nowrap",
            }}
          >
            <FileText size={16} strokeWidth={1.7} color={OC.muted} />
            <span style={{ marginLeft: 2 }}>Grew followers by</span>
            <span className="oc-loop pp-chip" style={{ display: "inline-block", padding: "2px 7px", borderRadius: 5, background: OC.text, color: "#fff", fontWeight: 700, fontSize: 15.5 }}>
              38%
            </span>
            <span>in four months.</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default ProofPageAnimated;
