import * as React from "react"
import {
  ChevronDown,
  FileText,
  Minus,
  Maximize2,
  X,
  Copy,
  Plus,
  Leaf,
  ArrowUp,
  CircleCheck,
  Lightbulb,
} from "lucide-react"
import { OC, clip } from "./palette.ts"

const PROMPT = "Tailor my CV for the Lumière posting"

const stack: React.CSSProperties = {
  gridArea: "1 / 1",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}

function Spinner({ className }: { className: string }) {
  return (
    <span className={`oc-loop ${className}`} style={{ ...stack, opacity: 0 }}>
      <svg className="pe-spin" width={16} height={16} viewBox="0 0 18 18">
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

function Check({ className }: { className: string }) {
  return (
    <span className={`oc-loop ${className}`} style={stack}>
      <CircleCheck size={16} strokeWidth={1.8} color={OC.text} />
    </span>
  )
}

function Pending({ className }: { className: string }) {
  return (
    <span className={`oc-loop ${className}`} style={{ ...stack, opacity: 0 }}>
      <svg width={16} height={16} viewBox="0 0 18 18">
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

function Step({
  className,
  icon,
  label,
  labelClass,
  meta,
}: {
  className: string
  icon: React.ReactNode
  label: string
  labelClass?: string
  meta?: React.ReactNode
}) {
  return (
    <div
      className={`oc-loop ${className}`}
      style={{ height: 28, display: "flex", alignItems: "center", gap: 10 }}
    >
      <span style={{ width: 16, height: 16, display: "grid", flexShrink: 0 }}>
        {icon}
      </span>
      <span
        className={labelClass ? `oc-loop ${labelClass}` : undefined}
        style={{
          fontSize: 13.5,
          fontWeight: 500,
          color: OC.text,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {meta && (
        <span style={{ fontSize: 13, color: OC.muted, whiteSpace: "nowrap" }}>
          {meta}
        </span>
      )}
    </div>
  )
}

/** Stacked crossfade values; only the one marked `settled` shows in the static frame. */
function Ticker({
  items,
}: {
  items: { className: string; text: string; settled?: boolean }[]
}) {
  return (
    <span style={{ display: "inline-grid" }}>
      {items.map((t) => (
        <span
          key={t.className}
          className={`oc-loop ${t.className}`}
          style={{
            gridArea: "1 / 1",
            opacity: t.settled ? 1 : 0,
            whiteSpace: "nowrap",
          }}
        >
          {t.text}
        </span>
      ))}
    </span>
  )
}

function IconButton({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        width: 28,
        height: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </span>
  )
}

export function CoachDock() {
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
        background: "var(--card)",
        borderRadius: 13,
        border: "1px solid var(--border)",
        boxShadow:
          "0 24px 56px -12px rgba(0,0,0,.14), 0 2px 8px rgba(0,0,0,.04)",
        zIndex: 5,
      }}
    >
      <div
        style={{
          height: 53,
          flexShrink: 0,
          padding: "0 13px 0 18px",
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid var(--muted)",
        }}
      >
        <span style={{ fontSize: 14.5, color: OC.text }}>
          Tailor CV for Lumière
        </span>
        <ChevronDown
          size={12}
          strokeWidth={1.8}
          color={OC.muted}
          style={{ marginLeft: 8 }}
        />
        <span style={{ flex: 1 }} />
        <IconButton>
          <Minus size={16} strokeWidth={1.6} color={OC.icon} />
        </IconButton>
        <span style={{ width: 9 }} />
        <IconButton>
          <Maximize2 size={15} strokeWidth={1.6} color={OC.icon} />
        </IconButton>
        <span style={{ width: 9 }} />
        <IconButton>
          <X size={16} strokeWidth={1.6} color={OC.icon} />
        </IconButton>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: "0 17px 0 18px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            marginTop: 16,
            textAlign: "center",
            fontSize: 12.5,
            lineHeight: "16px",
            color: OC.muted,
          }}
        >
          Today 9:41
        </div>
        <div
          className="oc-loop pe-ask"
          style={{
            alignSelf: "flex-end",
            marginTop: 15,
            height: 35,
            padding: "0 14px",
            borderRadius: 18,
            background: "var(--muted)",
            display: "flex",
            alignItems: "center",
            fontSize: 14,
            color: OC.text,
          }}
        >
          {PROMPT}
        </div>

        <div
          className="oc-loop pe-wk"
          style={{
            marginTop: 18,
            height: 20,
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 13.5,
            color: OC.muted,
          }}
        >
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
          <div
            className="oc-loop pe-steps"
            style={{
              gridArea: "1 / 1",
              opacity: 0,
              position: "relative",
              paddingLeft: 16,
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 1,
                top: 4,
                bottom: 52,
                width: 1.5,
                borderRadius: 1,
                background: "var(--accent)",
              }}
            />
            <Step
              className="pe-r1"
              icon={
                <>
                  <Spinner className="pe-s1" />
                  <Check className="pe-k1" />
                </>
              }
              label="Read Junior Marketing CV"
              meta="2 roles, 6 bullets"
            />
            <Step
              className="pe-r2"
              icon={
                <>
                  <Spinner className="pe-s2" />
                  <Check className="pe-k2" />
                </>
              }
              label="Read the Lumière posting"
              meta="Junior Marketing, HCMC"
            />
            <Step
              className="pe-r3"
              icon={
                <>
                  <Spinner className="pe-s3" />
                  <Check className="pe-k3" />
                </>
              }
              label="Rewriting bullets"
              meta={
                <Ticker
                  items={[
                    { className: "pe-m1", text: "1 of 3" },
                    { className: "pe-m2", text: "2 of 3" },
                    { className: "pe-m3", text: "3 of 3", settled: true },
                  ]}
                />
              }
            />
            <Step
              className="pe-r4"
              icon={
                <>
                  <Pending className="pe-p4" />
                  <Spinner className="pe-s4" />
                  <Check className="pe-k4" />
                </>
              }
              label="Check it still fits one page"
              labelClass="pe-l4"
            />
            <div
              style={{
                marginTop: 14,
                display: "flex",
                flexDirection: "column",
                gap: 9,
              }}
            >
              <div
                className="pe-shimmer"
                style={{ width: 340, height: 8, borderRadius: 4 }}
              />
              <div
                className="pe-shimmer"
                style={{ width: 300, height: 8, borderRadius: 4 }}
              />
              <div
                className="pe-shimmer"
                style={{ width: 190, height: 8, borderRadius: 4 }}
              />
            </div>
          </div>

          <div
            style={{
              gridArea: "1 / 1",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              className="oc-loop pe-done"
              style={{ fontSize: 14, lineHeight: "20px", color: OC.text }}
            >
              Done. I rewrote 3 bullets to match what Lumière asks for.
            </div>

            <div
              className="oc-loop pe-card"
              style={{
                marginTop: 16,
                height: 56,
                padding: "0 14px 0 13px",
                borderRadius: 14,
                border: "1px solid var(--accent)",
                display: "flex",
                alignItems: "center",
                gap: 11,
              }}
            >
              <span
                style={{
                  width: 29,
                  height: 29,
                  borderRadius: 7,
                  background: OC.text,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FileText size={15} strokeWidth={1.8} color="var(--card)" />
              </span>
              <span
                style={{ flex: 1, display: "flex", flexDirection: "column" }}
              >
                <span
                  style={{
                    fontSize: 13.5,
                    lineHeight: "17px",
                    fontWeight: 500,
                    color: OC.text,
                  }}
                >
                  Junior Marketing CV
                </span>
                <span
                  style={{
                    fontSize: 12.5,
                    lineHeight: "17px",
                    color: OC.muted,
                  }}
                >
                  3 changes
                </span>
              </span>
              <span
                style={{
                  height: 26,
                  padding: "0 10px",
                  borderRadius: 6,
                  background:
                    "linear-gradient(180deg, color-mix(in oklch, var(--chart-3) 12%, var(--card)) 0%, color-mix(in oklch, var(--chart-3) 18%, var(--card)) 100%)",
                  boxShadow:
                    "0 2px 8px color-mix(in oklch, var(--chart-3) 22%, transparent)",
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
            <span
              className="oc-loop pe-copy"
              style={{ marginTop: 15, display: "flex" }}
            >
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
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "grid",
            paddingLeft: 1,
            fontSize: 14,
            lineHeight: "20px",
          }}
        >
          <span
            className="oc-loop pe-ph"
            style={{ gridArea: "1 / 1", color: OC.muted }}
          >
            Reply...
          </span>
          <span
            style={{ gridArea: "1 / 1", display: "flex", alignItems: "center" }}
          >
            <span
              className="oc-loop pe-typed"
              style={{ ...clip, maxWidth: 0, color: OC.text }}
            >
              {PROMPT}
            </span>
            <span
              className="oc-loop pe-tcaret"
              style={{ display: "flex", opacity: 0 }}
            >
              <span
                className="pe-blink"
                style={{ width: 1.5, height: 17, background: OC.text }}
              />
            </span>
          </span>
        </div>
        <div
          style={{ marginTop: "auto", display: "flex", alignItems: "center" }}
        >
          <span
            style={{
              width: 31,
              height: 31,
              borderRadius: 16,
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plus size={15} strokeWidth={1.7} color={OC.text} />
          </span>
          <span
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13.5,
              color: OC.body,
            }}
          >
            <Leaf size={14} strokeWidth={1.6} color={OC.icon} />
            Free
            <ChevronDown
              size={11}
              strokeWidth={1.8}
              color={OC.muted}
              style={{ marginLeft: 2 }}
            />
          </span>
          <span style={{ marginLeft: 16, display: "grid" }}>
            <span
              style={{
                gridArea: "1 / 1",
                width: 31,
                height: 31,
                borderRadius: 16,
                background: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowUp size={15} strokeWidth={1.8} color="var(--chart-5)" />
            </span>
            {/* Ready to send once there's text. */}
            <span
              className="oc-loop pe-send"
              style={{
                gridArea: "1 / 1",
                opacity: 0,
                width: 31,
                height: 31,
                borderRadius: 16,
                background: OC.text,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowUp size={15} strokeWidth={2} color="var(--card)" />
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
