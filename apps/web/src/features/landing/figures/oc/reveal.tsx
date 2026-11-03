import * as React from "react"

import { useOnScreen } from "../use-on-screen.ts"
import "./reveal.css"

const delayStyle = (ms: number) =>
  ({ ["--landing-delay" as string]: `${ms}ms` }) as React.CSSProperties

export function RevealText({
  text,
  delay = 0,
  stagger = 45,
  className,
}: {
  text: string
  delay?: number
  stagger?: number
  className?: string
}) {
  const [ref, seen] = useOnScreen<HTMLSpanElement>({
    once: true,
    threshold: 0.15,
  })
  let word = 0
  return (
    <span
      ref={ref}
      className={[seen && "rv-on", className].filter(Boolean).join(" ")}
    >
      {text.split("\n").map((line, l) => (
        <React.Fragment key={l}>
          {l > 0 && (
            <>
              {" "}
              <br />
            </>
          )}
          {line.split(/(\s+)/).map((token, t) =>
            /^\s+$/.test(token) || token === "" ? (
              token
            ) : (
              <span
                key={t}
                className="rv-w"
                style={delayStyle(delay + word++ * stagger)}
              >
                {token}
              </span>
            )
          )}
        </React.Fragment>
      ))}
    </span>
  )
}

export function Reveal({
  delay = 0,
  className,
  children,
}: {
  delay?: number
  className?: string
  children?: React.ReactNode
}) {
  const [ref, seen] = useOnScreen<HTMLDivElement>({
    once: true,
    threshold: 0.15,
  })
  return (
    <div
      ref={ref}
      className={["rv-b", seen && "rv-on", className].filter(Boolean).join(" ")}
      style={delayStyle(delay)}
    >
      {children}
    </div>
  )
}
