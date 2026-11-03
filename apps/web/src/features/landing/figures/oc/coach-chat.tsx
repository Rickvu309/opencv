import * as React from "react"
import {
  ChevronDown,
  Star,
  Ellipsis,
  PictureInPicture2,
  Lightbulb,
  CircleCheck,
  Plus,
  Leaf,
} from "lucide-react"
import { AppShell } from "./app-shell.tsx"
import { OC, delay } from "./palette.ts"
import "./coach-chat.css"

const stack: React.CSSProperties = {
  gridArea: "1 / 1",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}

function Spinner({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span className={className} style={{ ...stack, ...style }}>
      <svg className="cc-spin" width={18} height={18} viewBox="0 0 18 18">
        <circle
          cx="9"
          cy="9"
          r="7"
          fill="none"
          stroke={OC.orange}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray="30 44"
        />
      </svg>
    </span>
  )
}

function Check({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span className={className} style={{ ...stack, ...style }}>
      <CircleCheck size={18} strokeWidth={1.8} color={OC.text} />
    </span>
  )
}

function Pending({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span className={className} style={{ ...stack, ...style }}>
      <svg width={18} height={18} viewBox="0 0 18 18">
        <circle
          cx="9"
          cy="9"
          r="7.25"
          fill="none"
          stroke="var(--input)"
          strokeWidth="1.5"
        />
      </svg>
    </span>
  )
}

function StepRow({
  className,
  icon,
  label,
  labelClass,
  labelStyle,
  meta,
}: {
  className: string
  icon: React.ReactNode
  label: string
  labelClass?: string
  labelStyle?: React.CSSProperties
  meta?: React.ReactNode
}) {
  return (
    <div
      className={`oc-loop ${className}`}
      style={{ height: 32, display: "flex", alignItems: "center", gap: 13 }}
    >
      <span style={{ width: 18, height: 18, display: "grid" }}>{icon}</span>
      <span
        className={labelClass}
        style={{
          fontSize: 15.5,
          fontWeight: 500,
          color: OC.text,
          ...labelStyle,
        }}
      >
        {label}
      </span>
      {meta && (
        <span style={{ fontSize: 15, color: OC.muted, marginLeft: 2 }}>
          {meta}
        </span>
      )}
    </div>
  )
}

const overlay = (
  className: string,
  opacity: number
): { className: string; style: React.CSSProperties } => ({
  className: `oc-loop ${className}`,
  style: { opacity },
})

export function CoachChatAnimated({
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
      active="coach"
      animate={animate}
      className={className}
      style={style}
    >
      <div
        className="oc-in-up"
        style={{
          ...delay(150),
          height: 56,
          flexShrink: 0,
          padding: "0 24px 0 22px",
          display: "flex",
          alignItems: "center",
          borderBottom: `1px solid ${OC.border}`,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 500 }}>
          CV for a cosmetics brand
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.8}
          color={OC.muted}
          style={{ marginLeft: 8 } as never}
        />
        <span style={{ marginLeft: 22, display: "flex" }}>
          <Star size={17} strokeWidth={1.7} color={OC.icon} />
        </span>
        <span style={{ marginLeft: 22, display: "flex" }}>
          <Ellipsis size={18} strokeWidth={1.8} color={OC.icon} />
        </span>
        <span style={{ marginLeft: "auto", display: "flex" }}>
          <PictureInPicture2 size={18} strokeWidth={1.7} color={OC.icon} />
        </span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          padding: "0 0 17px",
        }}
      >
        <div
          style={{
            width: 800,
            margin: "0 auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            className="oc-in-up"
            style={{
              ...delay(240),
              marginTop: 26,
              textAlign: "center",
              fontSize: 13.5,
              color: OC.muted,
            }}
          >
            Today 9:41
          </div>

          <div
            className="cc-bubble-in"
            style={{
              alignSelf: "flex-end",
              marginTop: 26,
              height: 52,
              padding: "0 22px",
              borderRadius: 26,
              background: "var(--muted)",
              display: "flex",
              alignItems: "center",
              fontSize: 16.5,
              color: OC.text,
            }}
          >
            Viết CV làm Junior Marketing cho một công ty mỹ phẩm
          </div>

          <div
            className="oc-in-up"
            style={{
              ...delay(520),
              marginTop: 20,
              marginLeft: 6,
              height: 24,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 15,
              color: OC.muted,
            }}
          >
            <Lightbulb size={15} strokeWidth={1.7} color={OC.muted} />
            <span style={{ display: "flex", alignItems: "center" }}>
              Working,&nbsp;
              <span style={{ display: "inline-grid" }}>
                <span
                  {...overlay("cc-w1", 0)}
                  style={{ gridArea: "1 / 1", opacity: 0 }}
                >
                  2s
                </span>
                <span
                  {...overlay("cc-w2", 0)}
                  style={{ gridArea: "1 / 1", opacity: 0 }}
                >
                  4s
                </span>
                <span {...overlay("cc-w3", 1)} style={{ gridArea: "1 / 1" }}>
                  9s
                </span>
                <span
                  {...overlay("cc-w4", 0)}
                  style={{ gridArea: "1 / 1", opacity: 0 }}
                >
                  12s
                </span>
              </span>
            </span>
            <ChevronDown size={13} strokeWidth={1.8} color={OC.muted} />
          </div>

          <div style={{ position: "relative", marginTop: 16, paddingLeft: 23 }}>
            <div
              className="oc-loop cc-guide"
              style={{
                position: "absolute",
                left: 0,
                top: 2,
                bottom: 2,
                width: 2,
                borderRadius: 1,
                background: "var(--accent)",
              }}
            />
            <StepRow
              className="cc-row1"
              icon={
                <>
                  <Spinner className="oc-loop cc-s1" style={{ opacity: 0 }} />
                  <Check className="oc-loop cc-k1" />
                </>
              }
              label="Read Junior Marketing CV"
              meta={<span className="oc-loop cc-m1">2 roles, 6 bullets</span>}
            />
            <StepRow
              className="cc-row2"
              icon={
                <>
                  <Spinner className="oc-loop cc-s2" style={{ opacity: 0 }} />
                  <Check className="oc-loop cc-k2" />
                </>
              }
              label="Read the Lumière Cosmetics posting"
              meta={
                <span className="oc-loop cc-m2">Junior Marketing, HCMC</span>
              }
            />
            <StepRow
              className="cc-row3"
              icon={
                <>
                  <Spinner className="oc-loop cc-s3" />
                  <Check className="oc-loop cc-k3" style={{ opacity: 0 }} />
                </>
              }
              label="Drafting bullet rewrites"
              meta={
                <span style={{ display: "inline-grid" }}>
                  <span
                    className="oc-loop cc-c1"
                    style={{ gridArea: "1 / 1", opacity: 0 }}
                  >
                    1 of 6
                  </span>
                  <span className="oc-loop cc-c3" style={{ gridArea: "1 / 1" }}>
                    3 of 6
                  </span>
                  <span
                    className="oc-loop cc-c6"
                    style={{ gridArea: "1 / 1", opacity: 0 }}
                  >
                    6 of 6
                  </span>
                </span>
              }
            />
            <StepRow
              className="cc-row4"
              icon={
                <>
                  <Pending className="oc-loop cc-p4" />
                  <Spinner className="oc-loop cc-s4" style={{ opacity: 0 }} />
                </>
              }
              label="Check it still fits one page"
              labelClass="oc-loop cc-t4"
              labelStyle={{ fontWeight: 400, color: OC.muted }}
            />
          </div>

          <div
            className="oc-loop cc-skel"
            style={{
              marginTop: 22,
              display: "flex",
              flexDirection: "column",
              gap: 11,
            }}
          >
            <div
              className="cc-shimmer"
              style={{
                width: 754,
                height: 9,
                borderRadius: 5,
                background: "var(--muted)",
              }}
            />
            <div
              className="cc-shimmer"
              style={{
                width: 686,
                height: 9,
                borderRadius: 5,
                background: "var(--muted)",
              }}
            />
            <div
              className="cc-shimmer"
              style={{
                width: 465,
                height: 9,
                borderRadius: 5,
                background: "var(--muted)",
              }}
            />
          </div>

          <div
            className="oc-in-up"
            style={{
              ...delay(460),
              marginTop: "auto",
              height: 126,
              padding: "18px 14px 14px 18px",
              borderRadius: 16,
              border: "1px solid var(--accent)",
              background: "var(--card)",
              boxShadow: "0 2px 10px rgba(0,0,0,.04)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span
              style={{
                paddingLeft: 4,
                fontSize: 16.5,
                lineHeight: "22px",
                color: OC.muted,
              }}
            >
              Coach is working. You can keep typing.
            </span>
            <div
              style={{
                marginTop: "auto",
                display: "flex",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  border: "1px solid var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus size={16} strokeWidth={1.8} color={OC.text} />
              </div>
              <span
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 16,
                  fontWeight: 500,
                  color: OC.body,
                }}
              >
                <Leaf size={16} strokeWidth={1.7} color={OC.icon} />
                Free
                <ChevronDown size={13} strokeWidth={1.8} color={OC.muted} />
              </span>
              <div
                style={{
                  marginLeft: 20,
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  background: OC.text,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: 2,
                    background: "var(--card)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export default CoachChatAnimated
