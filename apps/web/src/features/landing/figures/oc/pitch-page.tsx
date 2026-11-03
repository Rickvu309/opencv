import * as React from "react"
import { Download, Mail, Lock, ArrowRight } from "lucide-react"
import { AppShell } from "./app-shell.tsx"
import { OC, delay } from "./palette.ts"
import "./pitch-page.css"

const floating: React.CSSProperties = {
  background: "var(--card)",
  boxShadow:
    "0 0 0 1px rgba(0,0,0,.04), 0 12px 32px -8px rgba(0,0,0,.14), 0 2px 6px rgba(0,0,0,.04)",
}

function Swap({
  from,
  to,
  oldClass,
  newClass,
}: {
  from: string
  to: string
  oldClass: string
  newClass: string
}) {
  return (
    <span style={{ display: "inline-grid" }}>
      <span
        className={`oc-loop ${oldClass}`}
        style={{ gridArea: "1 / 1", opacity: 0 }}
      >
        {from}
      </span>
      <span className={`oc-loop ${newClass}`} style={{ gridArea: "1 / 1" }}>
        {to}
      </span>
    </span>
  )
}

function SmallButton({
  dark,
  children,
}: {
  dark?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        height: 33,
        padding: "0 12px",
        borderRadius: 7,
        display: "flex",
        alignItems: "center",
        gap: 7,
        fontSize: 14.5,
        fontWeight: 500,
        color: dark ? "var(--card)" : OC.body,
        background: dark ? OC.text : "var(--card)",
        border: `1px solid ${dark ? OC.text : "var(--border)"}`,
      }}
    >
      {children}
    </div>
  )
}

const viewBars = [9, 16, 12, 23, 19, 30]

export function PitchPageAnimated({
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
      active="pitch"
      animate={animate}
      className={className}
      style={style}
    >
      <div
        style={{
          height: 56,
          flexShrink: 0,
          padding: "0 22px",
          display: "flex",
          alignItems: "center",
          background: "var(--background)",
          borderBottom: `1px solid ${OC.border}`,
          fontSize: 15,
        }}
      >
        Pitch
      </div>

      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          background:
            "radial-gradient(ellipse 620px 460px at 82% 52%, var(--secondary) 0%, color-mix(in oklch, var(--card) 0%, transparent) 70%), var(--card)",
        }}
      >
        <div style={{ position: "absolute", left: 69, top: 273 }}>
          <div
            className="oc-in-up"
            style={{
              ...delay(200),
              height: 29,
              padding: "0 11px 0 10px",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              borderRadius: 15,
              border: "1px solid var(--accent)",
              fontSize: 13.5,
              color: OC.secondary,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: "var(--chart-5)",
              }}
            />
            Coming soon
          </div>
          <div
            className="oc-in-up"
            style={{
              ...delay(260),
              margin: "20px 0 0",
              fontSize: 68,
              lineHeight: "72px",
              fontWeight: 700,
              letterSpacing: -2.2,
              color: OC.text,
            }}
          >
            One link
            <br />
            that sells you
          </div>
          <p
            className="oc-in-up"
            style={{
              ...delay(320),
              margin: "14px 0 0",
              fontSize: 19,
              lineHeight: "26px",
              color: OC.secondary,
            }}
          >
            Your CV and Proofs on one page.
          </p>
          <div
            className="oc-in-up"
            style={{
              ...delay(380),
              marginTop: 36,
              width: 184,
              height: 43,
              borderRadius: 8,
              background: OC.text,
              color: "var(--card)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            Get early access
            <ArrowRight size={16} strokeWidth={2} />
          </div>
        </div>

        <div
          className="pp-window-in"
          style={{
            position: "absolute",
            left: 659,
            top: 195,
            width: 760,
            height: 459,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 12,
              background: "var(--card)",
              border: `1px solid ${OC.border}`,
              boxShadow: "0 24px 60px -24px rgba(0,0,0,.18)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: 43,
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "0 18px",
                borderBottom: `1px solid ${OC.border}`,
                background: "var(--background)",
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    background: "var(--border)",
                  }}
                />
              ))}
              <div
                style={{
                  position: "absolute",
                  left: 332,
                  top: 8,
                  width: 195,
                  height: 27,
                  borderRadius: 7,
                  border: `1px solid ${OC.border}`,
                  background: "var(--card)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  fontSize: 13,
                  color: OC.secondary,
                }}
              >
                <Lock size={11} strokeWidth={2} color={OC.muted} />
                opencv.me/u/linh-nguyen
              </div>
            </div>

            <div style={{ padding: "31px 0 0 48px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div
                  style={{
                    width: 66,
                    height: 66,
                    borderRadius: 33,
                    background:
                      "linear-gradient(145deg, var(--muted) 0%, var(--input) 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 21,
                    fontWeight: 600,
                    color: "var(--muted-foreground)",
                  }}
                >
                  LN
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 32,
                      lineHeight: "38px",
                      fontWeight: 600,
                      letterSpacing: -0.8,
                    }}
                  >
                    Linh Nguyen
                  </div>
                  <div style={{ fontSize: 15, color: OC.muted }}>
                    Marketing, Ho Chi Minh City
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 24, fontSize: 17, color: OC.body }}>
                I listen to buyers, then write content that sells.
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                <SmallButton dark>
                  <Download size={14} strokeWidth={2} />
                  Download CV
                </SmallButton>
                <SmallButton>
                  <Mail size={14} strokeWidth={1.8} color={OC.icon} />
                  Email
                </SmallButton>
                <SmallButton>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: -0.5,
                      color: OC.icon,
                    }}
                  >
                    in
                  </span>
                  LinkedIn
                </SmallButton>
              </div>
              <div
                style={{
                  marginTop: 32,
                  fontSize: 12.5,
                  fontWeight: 500,
                  letterSpacing: 1,
                  color: OC.muted,
                }}
              >
                PROOF OF WORK
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 13 }}>
                <div style={{ width: 375, flexShrink: 0 }}>
                  <div
                    style={{
                      height: 107,
                      borderRadius: 10,
                      background: "var(--secondary)",
                    }}
                  >
                    <svg
                      width={375}
                      height={107}
                      viewBox="0 0 375 107"
                      style={{ display: "block" }}
                    >
                      <path
                        className="oc-loop pp-line"
                        pathLength={1}
                        d="M64 76 L90 75 L112 72 L130 66 L152 64 L175 58 L196 55 L220 48 L245 43 L270 37 L308 31"
                        fill="none"
                        stroke={OC.text}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ strokeDasharray: 1, strokeDashoffset: 0 }}
                      />
                      <circle
                        className="oc-loop pp-dot"
                        cx={308}
                        cy={31}
                        r={4.5}
                        fill={OC.text}
                      />
                    </svg>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 15, fontWeight: 600 }}>
                    Followers +38%
                  </div>
                </div>
                <div style={{ width: 375, flexShrink: 0 }}>
                  <div
                    style={{
                      height: 107,
                      borderRadius: 10,
                      background: "var(--secondary)",
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 9,
                      padding: "0 0 23px 104px",
                    }}
                  >
                    {[19, 23, 27, 23, 33].map((h, i) => (
                      <span
                        key={i}
                        style={{
                          width: 29,
                          height: h,
                          borderRadius: 3,
                          background: "var(--border)",
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 15, fontWeight: 600 }}>
                    52% open rate
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="pp-float-a"
          style={{ position: "absolute", left: 603, top: 149 }}
        >
          <div className="oc-in-up" style={delay(760)}>
            <div
              className="oc-loop pp-dl"
              style={{
                ...floating,
                height: 61,
                padding: "0 22px 0 12px",
                borderRadius: 31,
                display: "flex",
                alignItems: "center",
                gap: 11,
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 37,
                  height: 37,
                  borderRadius: 19,
                  background: OC.text,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Download size={16} strokeWidth={2} color="var(--card)" />
              </span>
              <span>
                <Swap from="2" to="3" oldClass="pp-d-old" newClass="pp-d-new" />{" "}
                CV downloads
              </span>
            </div>
          </div>
        </div>

        <div
          className="pp-float-b"
          style={{ position: "absolute", left: 579, top: 639 }}
        >
          <div
            className="oc-loop pp-notif"
            style={{
              ...floating,
              height: 64,
              padding: "0 24px 0 14px",
              borderRadius: 32,
              display: "flex",
              alignItems: "center",
              gap: 13,
            }}
          >
            <span
              style={{
                width: 35,
                height: 35,
                borderRadius: 18,
                background: "var(--muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 600,
                color: OC.secondary,
              }}
            >
              HT
            </span>
            <span>
              <div
                style={{ fontSize: 15, fontWeight: 600, lineHeight: "20px" }}
              >
                Hanh Tran opened your Pitch
              </div>
              <div
                style={{ fontSize: 13, color: OC.muted, lineHeight: "17px" }}
              >
                Just now
              </div>
            </span>
          </div>
        </div>

        <div
          className="pp-float-c"
          style={{ position: "absolute", left: 1044, top: 605 }}
        >
          <div className="oc-in-up" style={delay(860)}>
            <div
              style={{
                ...floating,
                width: 220,
                height: 116,
                padding: "16px 18px 14px",
                borderRadius: 13,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                <span
                  style={{
                    fontSize: 30,
                    lineHeight: "34px",
                    fontWeight: 600,
                    letterSpacing: -0.5,
                  }}
                >
                  <Swap
                    from="23"
                    to="24"
                    oldClass="pp-v-old"
                    newClass="pp-v-new"
                  />
                </span>
                <span style={{ fontSize: 13.5, color: OC.muted }}>views</span>
              </div>
              <div
                style={{
                  marginTop: "auto",
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 7,
                }}
              >
                {viewBars.map((h, i) => (
                  <span
                    key={i}
                    style={{
                      width: 20,
                      height: h,
                      borderRadius: 2,
                      background: "var(--border)",
                    }}
                  />
                ))}
                <span
                  className="oc-loop pp-bar"
                  style={{
                    width: 20,
                    height: 37,
                    borderRadius: 2,
                    background: OC.text,
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

export default PitchPageAnimated
