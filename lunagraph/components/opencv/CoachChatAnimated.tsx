import * as React from "react";
import {
  ChevronDown,
  Star,
  Ellipsis,
  PictureInPicture2,
  Lightbulb,
  CircleCheck,
  Plus,
  Leaf,
} from "lucide-react";
import { AppShell, OC, delay } from "./AppShell";

/*
 * Loop (8s, after the entrance): the agent run plays out.
 *   0%   step 1 appears spinning, resolves at 15%
 *   17%  step 2 appears spinning, resolves at 32%
 *   34%  step 3 appears spinning, counts 1 → 3 → 6 of 6, resolves at 70%
 *   40%  step 4 appears pending, turns active at 72%
 *   38%  skeleton lines fade in and shimmer
 *   96%  everything fades out and the run restarts
 * Base styles (static / reduced motion) show the reference moment: 2 done, 1 drafting, 1 pending.
 */
const css = `
.cc-bubble-in { animation: cc-bubble-in .6s cubic-bezier(.22,1,.36,1) 320ms both; }
@keyframes cc-bubble-in { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: none; } }

.cc-spin { animation: cc-spin .9s linear infinite; transform-origin: 50% 50%; }
@keyframes cc-spin { to { transform: rotate(360deg); } }

.cc-shimmer { background: linear-gradient(90deg, #EDEDEC 0%, #EDEDEC 35%, #F7F7F6 50%, #EDEDEC 65%, #EDEDEC 100%); background-size: 300% 100%; animation: cc-shimmer 1.8s linear infinite; }
@keyframes cc-shimmer { from { background-position: 100% 0; } to { background-position: 0% 0; } }

.oc-static .cc-bubble-in, .oc-static .cc-spin, .oc-static .cc-shimmer { animation: none !important; }
@media (prefers-reduced-motion: reduce) {
  .oc-root .cc-bubble-in, .oc-root .cc-spin, .oc-root .cc-shimmer { animation: none !important; }
}

.cc-row1 { animation-name: cc-row1; } .cc-row2 { animation-name: cc-row2; }
.cc-row3 { animation-name: cc-row3; } .cc-row4 { animation-name: cc-row4; }
@keyframes cc-row1 { 0% { opacity: 0; transform: translateY(6px); animation-timing-function: cubic-bezier(.22,1,.36,1); } 3%, 93% { opacity: 1; transform: none; } 97%, 100% { opacity: 0; } }
@keyframes cc-row2 { 0%, 17% { opacity: 0; transform: translateY(6px); animation-timing-function: cubic-bezier(.22,1,.36,1); } 20%, 93% { opacity: 1; transform: none; } 97%, 100% { opacity: 0; } }
@keyframes cc-row3 { 0%, 34% { opacity: 0; transform: translateY(6px); animation-timing-function: cubic-bezier(.22,1,.36,1); } 37%, 93% { opacity: 1; transform: none; } 97%, 100% { opacity: 0; } }
@keyframes cc-row4 { 0%, 40% { opacity: 0; transform: translateY(6px); animation-timing-function: cubic-bezier(.22,1,.36,1); } 43%, 93% { opacity: 1; transform: none; } 97%, 100% { opacity: 0; } }

.cc-guide { animation-name: cc-guide; transform-origin: top; }
@keyframes cc-guide { 0% { transform: scaleY(.25); opacity: 0; } 3% { opacity: 1; } 17% { transform: scaleY(.25); } 20% { transform: scaleY(.5); } 34% { transform: scaleY(.5); } 37% { transform: scaleY(.75); } 40% { transform: scaleY(.75); } 43%, 93% { transform: none; opacity: 1; } 97%, 100% { opacity: 0; } }

.cc-s1 { animation-name: cc-s1; } .cc-k1 { animation-name: cc-k1; }
.cc-s2 { animation-name: cc-s2; } .cc-k2 { animation-name: cc-k2; }
.cc-s3 { animation-name: cc-s3; } .cc-k3 { animation-name: cc-k3; }
.cc-p4 { animation-name: cc-p4; } .cc-s4 { animation-name: cc-s4; }
@keyframes cc-s1 { 0%, 14% { opacity: 1; } 15%, 100% { opacity: 0; } }
@keyframes cc-k1 { 0%, 14% { opacity: 0; transform: scale(.6); animation-timing-function: cubic-bezier(.34,1.56,.64,1); } 17%, 100% { opacity: 1; transform: none; } }
@keyframes cc-s2 { 0%, 31% { opacity: 1; } 32%, 100% { opacity: 0; } }
@keyframes cc-k2 { 0%, 31% { opacity: 0; transform: scale(.6); animation-timing-function: cubic-bezier(.34,1.56,.64,1); } 34%, 100% { opacity: 1; transform: none; } }
@keyframes cc-s3 { 0%, 69% { opacity: 1; } 70%, 100% { opacity: 0; } }
@keyframes cc-k3 { 0%, 69% { opacity: 0; transform: scale(.6); animation-timing-function: cubic-bezier(.34,1.56,.64,1); } 72%, 100% { opacity: 1; transform: none; } }
@keyframes cc-p4 { 0%, 71% { opacity: 1; } 72%, 100% { opacity: 0; } }
@keyframes cc-s4 { 0%, 71% { opacity: 0; } 73%, 100% { opacity: 1; } }

.cc-t4 { animation-name: cc-t4; }
@keyframes cc-t4 { 0%, 71% { color: ${OC.muted}; font-weight: 400; } 74%, 100% { color: ${OC.text}; font-weight: 500; } }

.cc-m1 { animation-name: cc-m1; } .cc-m2 { animation-name: cc-m2; }
@keyframes cc-m1 { 0%, 14% { opacity: 0; } 18%, 100% { opacity: 1; } }
@keyframes cc-m2 { 0%, 31% { opacity: 0; } 35%, 100% { opacity: 1; } }

.cc-c1 { animation-name: cc-c1; } .cc-c3 { animation-name: cc-c3; } .cc-c6 { animation-name: cc-c6; }
@keyframes cc-c1 { 0%, 49% { opacity: 1; transform: none; } 51%, 100% { opacity: 0; transform: translateY(-4px); } }
@keyframes cc-c3 { 0%, 49% { opacity: 0; transform: translateY(4px); } 51%, 66% { opacity: 1; transform: none; } 68%, 100% { opacity: 0; transform: translateY(-4px); } }
@keyframes cc-c6 { 0%, 66% { opacity: 0; transform: translateY(4px); } 68%, 100% { opacity: 1; transform: none; } }

.cc-skel { animation-name: cc-skel; }
@keyframes cc-skel { 0%, 36% { opacity: 0; } 40%, 93% { opacity: 1; } 97%, 100% { opacity: 0; } }

.cc-w1 { animation-name: cc-w1; } .cc-w2 { animation-name: cc-w2; } .cc-w3 { animation-name: cc-w3; } .cc-w4 { animation-name: cc-w4; }
@keyframes cc-w1 { 0%, 17% { opacity: 1; } 19%, 97% { opacity: 0; } 99%, 100% { opacity: 1; } }
@keyframes cc-w2 { 0%, 17% { opacity: 0; } 19%, 39% { opacity: 1; } 41%, 100% { opacity: 0; } }
@keyframes cc-w3 { 0%, 39% { opacity: 0; } 41%, 69% { opacity: 1; } 71%, 100% { opacity: 0; } }
@keyframes cc-w4 { 0%, 69% { opacity: 0; } 71%, 97% { opacity: 1; } 99%, 100% { opacity: 0; } }
`;

const stack: React.CSSProperties = { gridArea: "1 / 1", display: "flex", alignItems: "center", justifyContent: "center" };

function Spinner({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span className={className} style={{ ...stack, ...style }}>
      <svg className="cc-spin" width={18} height={18} viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="7" fill="none" stroke={OC.orange} strokeWidth="1.8" strokeLinecap="round" strokeDasharray="30 44" />
      </svg>
    </span>
  );
}

function Check({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span className={className} style={{ ...stack, ...style }}>
      <CircleCheck size={18} strokeWidth={1.8} color={OC.text} />
    </span>
  );
}

function Pending({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span className={className} style={{ ...stack, ...style }}>
      <svg width={18} height={18} viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="7.25" fill="none" stroke="#CDCDCB" strokeWidth="1.5" />
      </svg>
    </span>
  );
}

function StepRow({ className, icon, label, labelClass, labelStyle, meta }: {
  className: string;
  icon: React.ReactNode;
  label: string;
  labelClass?: string;
  labelStyle?: React.CSSProperties;
  meta?: React.ReactNode;
}) {
  return (
    <div className={`oc-loop ${className}`} style={{ height: 32, display: "flex", alignItems: "center", gap: 13 }}>
      <span style={{ width: 18, height: 18, display: "grid" }}>{icon}</span>
      <span className={labelClass} style={{ fontSize: 15.5, fontWeight: 500, color: OC.text, ...labelStyle }}>{label}</span>
      {meta && <span style={{ fontSize: 15, color: OC.muted, marginLeft: 2 }}>{meta}</span>}
    </div>
  );
}

const overlay = (className: string, opacity: number): { className: string; style: React.CSSProperties } => ({
  className: `oc-loop ${className}`,
  style: { opacity },
});

export function CoachChatAnimated({
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
    <AppShell active="coach" animate={animate} css={css} className={className} style={style}>
      <header className="oc-in-up" style={{ ...delay(150), height: 56, flexShrink: 0, padding: "0 24px 0 22px", display: "flex", alignItems: "center", borderBottom: `1px solid ${OC.border}` }}>
        <span style={{ fontSize: 15, fontWeight: 500 }}>CV for a cosmetics brand</span>
        <ChevronDown size={14} strokeWidth={1.8} color={OC.muted} style={{ marginLeft: 8 } as never} />
        <span style={{ marginLeft: 22, display: "flex" }}>
          <Star size={17} strokeWidth={1.7} color={OC.icon} />
        </span>
        <span style={{ marginLeft: 22, display: "flex" }}>
          <Ellipsis size={18} strokeWidth={1.8} color={OC.icon} />
        </span>
        <span style={{ marginLeft: "auto", display: "flex" }}>
          <PictureInPicture2 size={18} strokeWidth={1.7} color={OC.icon} />
        </span>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "0 0 17px" }}>
        <div style={{ width: 800, margin: "0 auto", flex: 1, display: "flex", flexDirection: "column" }}>
          <div className="oc-in-up" style={{ ...delay(240), marginTop: 26, textAlign: "center", fontSize: 13.5, color: OC.muted }}>
            Today 9:41
          </div>

          <div
            className="cc-bubble-in"
            style={{ alignSelf: "flex-end", marginTop: 26, height: 52, padding: "0 22px", borderRadius: 26, background: "#F2F2F1", display: "flex", alignItems: "center", fontSize: 16.5, color: OC.text }}
          >
            Viết CV làm Junior Marketing cho một công ty mỹ phẩm
          </div>

          <div className="oc-in-up" style={{ ...delay(520), marginTop: 20, marginLeft: 6, height: 24, display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: OC.muted }}>
            <Lightbulb size={15} strokeWidth={1.7} color={OC.muted} />
            <span style={{ display: "flex", alignItems: "center" }}>
              Working,&nbsp;
              <span style={{ display: "inline-grid" }}>
                <span {...overlay("cc-w1", 0)} style={{ gridArea: "1 / 1", opacity: 0 }}>2s</span>
                <span {...overlay("cc-w2", 0)} style={{ gridArea: "1 / 1", opacity: 0 }}>4s</span>
                <span {...overlay("cc-w3", 1)} style={{ gridArea: "1 / 1" }}>9s</span>
                <span {...overlay("cc-w4", 0)} style={{ gridArea: "1 / 1", opacity: 0 }}>12s</span>
              </span>
            </span>
            <ChevronDown size={13} strokeWidth={1.8} color={OC.muted} />
          </div>

          <div style={{ position: "relative", marginTop: 16, paddingLeft: 23 }}>
            <div className="oc-loop cc-guide" style={{ position: "absolute", left: 0, top: 2, bottom: 2, width: 2, borderRadius: 1, background: "#E6E6E4" }} />
            <StepRow
              className="cc-row1"
              icon={<><Spinner className="oc-loop cc-s1" style={{ opacity: 0 }} /><Check className="oc-loop cc-k1" /></>}
              label="Read Junior Marketing CV"
              meta={<span className="oc-loop cc-m1">2 roles, 6 bullets</span>}
            />
            <StepRow
              className="cc-row2"
              icon={<><Spinner className="oc-loop cc-s2" style={{ opacity: 0 }} /><Check className="oc-loop cc-k2" /></>}
              label="Read the Lumière Cosmetics posting"
              meta={<span className="oc-loop cc-m2">Junior Marketing, HCMC</span>}
            />
            <StepRow
              className="cc-row3"
              icon={<><Spinner className="oc-loop cc-s3" /><Check className="oc-loop cc-k3" style={{ opacity: 0 }} /></>}
              label="Drafting bullet rewrites"
              meta={
                <span style={{ display: "inline-grid" }}>
                  <span className="oc-loop cc-c1" style={{ gridArea: "1 / 1", opacity: 0 }}>1 of 6</span>
                  <span className="oc-loop cc-c3" style={{ gridArea: "1 / 1" }}>3 of 6</span>
                  <span className="oc-loop cc-c6" style={{ gridArea: "1 / 1", opacity: 0 }}>6 of 6</span>
                </span>
              }
            />
            <StepRow
              className="cc-row4"
              icon={<><Pending className="oc-loop cc-p4" /><Spinner className="oc-loop cc-s4" style={{ opacity: 0 }} /></>}
              label="Check it still fits one page"
              labelClass="oc-loop cc-t4"
              labelStyle={{ fontWeight: 400, color: OC.muted }}
            />
          </div>

          <div className="oc-loop cc-skel" style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 11 }}>
            <div className="cc-shimmer" style={{ width: 754, height: 9, borderRadius: 5, background: "#EDEDEC" }} />
            <div className="cc-shimmer" style={{ width: 686, height: 9, borderRadius: 5, background: "#EDEDEC" }} />
            <div className="cc-shimmer" style={{ width: 465, height: 9, borderRadius: 5, background: "#EDEDEC" }} />
          </div>

          <div
            className="oc-in-up"
            style={{
              ...delay(460),
              marginTop: "auto",
              height: 126,
              padding: "18px 14px 14px 18px",
              borderRadius: 16,
              border: "1px solid #E6E6E4",
              background: "#fff",
              boxShadow: "0 2px 10px rgba(0,0,0,.04)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span style={{ paddingLeft: 4, fontSize: 16.5, lineHeight: "22px", color: OC.muted }}>
              Coach is working. You can keep typing.
            </span>
            <div style={{ marginTop: "auto", display: "flex", alignItems: "center" }}>
              <div style={{ width: 34, height: 34, borderRadius: 17, border: "1px solid #E6E6E4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus size={16} strokeWidth={1.8} color={OC.text} />
              </div>
              <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 16, fontWeight: 500, color: OC.body }}>
                <Leaf size={16} strokeWidth={1.7} color={OC.icon} />
                Free
                <ChevronDown size={13} strokeWidth={1.8} color={OC.muted} />
              </span>
              <div style={{ marginLeft: 20, width: 36, height: 36, borderRadius: 18, background: OC.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ width: 11, height: 11, borderRadius: 2, background: "#fff" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default CoachChatAnimated;
