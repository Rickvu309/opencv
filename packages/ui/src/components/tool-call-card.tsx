"use client"

import { copyText } from "./copy-button"
import { css } from "./tool-call-card-styles"

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react"

export type ToolCallStatus = "awaiting" | "running" | "success" | "error"

export type ToolCallCardProps = {
  name: string
  summary?: ReactNode
  icon?: ReactNode
  status: ToolCallStatus
  args?: unknown
  result?: unknown
  error?: string
  startedAtMs?: number
  durationMs?: number
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  openOnError?: boolean
  onRetry?: () => void
  maxCodeHeight?: number
  className?: string
}

export type ToolCallGroupProps = {
  children: ReactNode
  label?: string
  runningLabel?: string
  durationMs?: number
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function ToolCallCard({
  name,
  summary,
  icon,
  status,
  args,
  result,
  error,
  startedAtMs,
  durationMs,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  openOnError = true,
  onRetry,
  maxCodeHeight = 220,
  className,
}: ToolCallCardProps) {
  const id = useId()
  const [openState, setOpenState] = useState(defaultOpen)
  const open = openProp ?? openState
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next)
    onOpenChange?.(next)
  }

  const [prevStatus, setPrevStatus] = useState(status)
  const [autoOpened, setAutoOpened] = useState(false)
  if (status !== prevStatus) {
    setPrevStatus(status)
    if (openProp === undefined && openOnError) {
      if (status === "error" && !openState) {
        setOpenState(true)
        setAutoOpened(true)
      } else if (prevStatus === "error" && autoOpened) {
        setOpenState(false)
        setAutoOpened(false)
      }
    }
  }

  const measured = useStopwatch(status === "running", startedAtMs, false)
  const ms = status === "running" ? (measured ?? 0) : (durationMs ?? measured)

  const announce =
    status === "awaiting"
      ? `${name} needs your approval`
      : status === "running"
        ? `${name} running`
        : status === "success"
          ? `${name} finished${typeof summary === "string" ? `: ${summary}` : ""}`
          : `${name} failed${error ? `: ${error}` : ""}`

  return (
    <div
      data-slot="tool-call-card"
      className={["ui-tcc", className].filter(Boolean).join(" ")}
      data-status={status}
      data-open={open || undefined}
    >
      <style href="ui-tool-call-clean" precedence="default">
        {css}
      </style>
      <span className="ui-tcc-sr" role="status" aria-live="polite">
        {announce}
      </span>

      <button
        type="button"
        className="ui-tcc__head"
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={() => {
          setAutoOpened(false)
          setOpen(!open)
        }}
      >
        <span className="ui-tcc__icon" aria-hidden="true">
          {icon ?? <WrenchIcon />}
        </span>
        <span className="ui-tcc__main">
          <span className="ui-tcc__name">{name}</span>
          {summary != null && (
            <span
              className="ui-tcc__summary"
              title={typeof summary === "string" ? summary : undefined}
            >
              {summary}
            </span>
          )}
        </span>
        <span className="ui-tcc__status" key={status}>
          {status === "awaiting" && (
            <span className="ui-tcc__awaiting">Needs your approval</span>
          )}
          {status === "running" && <Spinner />}
          {status === "success" && (
            <svg className="ui-tcc__ok" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="7" />
              <path d="M5.1 8.2 7.1 10.1 10.9 6" pathLength={1} />
            </svg>
          )}
          {status === "error" && <ErrorIcon />}
          {status !== "awaiting" && (
            <span className="ui-tcc__time">
              {status === "error"
                ? "Failed"
                : ms != null
                  ? formatMs(ms, status === "running")
                  : null}
            </span>
          )}
        </span>
        <Chevron />
      </button>

      <div className="ui-tcc__body" id={`${id}-body`} inert={!open}>
        <div className="ui-tcc__clip">
          <div className="ui-tcc__sections">
            {status === "error" && (
              <div className="ui-tcc__error">
                <ErrorIcon />
                <p className="ui-tcc__error-text">
                  {error ?? "The tool call failed."}
                </p>
                {onRetry && (
                  <button
                    type="button"
                    className="ui-tcc__retry"
                    onClick={onRetry}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M2.75 8a5.25 5.25 0 1 0 1.6-3.77" />
                      <path d="M2.5 2.5v2.75h2.75" />
                    </svg>
                    Retry
                  </button>
                )}
              </div>
            )}
            {args !== undefined && (
              <CodeSection label="Arguments" value={args} cap={maxCodeHeight} />
            )}
            {result !== undefined ? (
              <CodeSection label="Result" value={result} cap={maxCodeHeight} />
            ) : status === "running" ? (
              <div className="ui-tcc__section">
                <div className="ui-tcc__section-head">
                  <span className="ui-tcc__label">Result</span>
                </div>
                <p className="ui-tcc__pending">Waiting for result…</p>
              </div>
            ) : null}
            {args === undefined &&
              result === undefined &&
              status === "success" && (
                <p className="ui-tcc__pending">No arguments or result.</p>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ToolCallGroup({
  children,
  label,
  runningLabel = "Using tools…",
  durationMs,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  className,
}: ToolCallGroupProps) {
  const id = useId()
  const [openState, setOpenState] = useState(defaultOpen)
  const open = openProp ?? openState

  const visibleChildren = Children.toArray(children).filter(
    (child) =>
      !isValidElement<Partial<ToolCallCardProps>>(child) ||
      !child.props.className?.split(" ").includes("hidden")
  )
  const calls = visibleChildren
    .filter(isValidElement)
    .map((c) => (c as ReactElement<Partial<ToolCallCardProps>>).props)
  const running = calls.some((c) => c.status === "running")
  const failed = calls.filter((c) => c.status === "error").length

  const measured = useStopwatch(running, undefined, true)
  const sum =
    calls.length && calls.every((c) => c.durationMs != null)
      ? calls.reduce((t, c) => t + (c.durationMs ?? 0), 0)
      : null
  const ms = running ? measured : (durationMs ?? sum ?? measured)

  const count = `Used ${calls.length} ${calls.length === 1 ? "tool" : "tools"}`
  const title = running ? runningLabel : (label ?? count)
  const icons = calls.slice(-3)

  if (!calls.length) return null

  return (
    <div
      className={["ui-tcc-group", className].filter(Boolean).join(" ")}
      data-running={running || undefined}
      data-open={open || undefined}
    >
      <style href="ui-tool-call-clean" precedence="default">
        {css}
      </style>
      <span className="ui-tcc-sr" role="status" aria-live="polite">
        {running
          ? runningLabel
          : `${count}${failed ? `, ${failed} failed` : ""}`}
      </span>

      <button
        type="button"
        className="ui-tcc-group__head"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={() => {
          if (openProp === undefined) setOpenState(!open)
          onOpenChange?.(!open)
        }}
      >
        <span className="ui-tcc-group__stack" aria-hidden="true">
          {icons.map((c, i) => (
            <span
              className="ui-tcc__icon"
              key={calls.length - icons.length + i}
            >
              {c.icon ?? <WrenchIcon />}
            </span>
          ))}
        </span>
        <span className="ui-tcc-group__title" key={running ? "busy" : "done"}>
          <span
            className={
              running
                ? "ui-tcc-group__label ui-tcc__shine"
                : "ui-tcc-group__label"
            }
            data-text={title}
          >
            {title}
          </span>
          {!running && failed > 0 && (
            <span className="ui-tcc-group__failed">{failed} failed</span>
          )}
          {ms != null && (
            <span className="ui-tcc-group__time">{formatMs(ms, running)}</span>
          )}
        </span>
        <Chevron />
      </button>

      <div className="ui-tcc__body" id={`${id}-list`} inert={!open}>
        <div className="ui-tcc__clip">
          <div className="ui-tcc-group__list">{visibleChildren}</div>
        </div>
      </div>
    </div>
  )
}

function CodeSection({
  label,
  value,
  cap,
}: {
  label: string
  value: unknown
  cap: number
}) {
  const { text, json } = toText(value)
  const pre = useRef<HTMLPreElement>(null)
  const [full, setFull] = useState(false)
  const [height, setHeight] = useState(0)

  useLayoutEffect(() => {
    const el = pre.current
    const inner = el?.firstElementChild
    if (!el || !inner) return
    const measure = () => setHeight(el.scrollHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(inner)
    return () => ro.disconnect()
  }, [text])

  const capped = height > cap + 24

  return (
    <div className="ui-tcc__section">
      <div className="ui-tcc__section-head">
        <span className="ui-tcc__label">{label}</span>
        <CopyButton text={text} label={label.toLowerCase()} />
      </div>
      <pre
        ref={pre}
        className="ui-tcc__code"
        data-capped={(capped && !full) || undefined}
        style={capped ? { maxHeight: full ? height : cap } : undefined}
      >
        <code>{json ? highlight(text) : text}</code>
      </pre>
      {capped && (
        <button
          type="button"
          className="ui-tcc__more"
          aria-expanded={full}
          onClick={() => setFull(!full)}
        >
          {full ? "Show less" : "Show all"}
        </button>
      )}
    </div>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(t)
  }, [copied])

  return (
    <button
      type="button"
      className="ui-tcc__copy"
      data-copied={copied || undefined}
      aria-label={copied ? "Copied" : `Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
      onClick={() => copyText(text).then((ok) => ok && setCopied(true))}
    >
      <svg className="ui-tcc__copy-icon" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="5.5" y="5.5" width="8.5" height="8.5" rx="2" />
        <path d="M10.5 3.75v-.25A1.5 1.5 0 0 0 9 2H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5h.25" />
      </svg>
      <svg className="ui-tcc__copy-done" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 8.4 6.6 11.3 12.5 4.9" pathLength={1} />
      </svg>
    </button>
  )
}

function Spinner() {
  return (
    <svg className="ui-tcc__spinner" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 2a6 6 0 0 1 6 6" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg className="ui-tcc__err" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="7" />
      <path d="M8 4.9v3.5M8 10.9v.1" />
    </svg>
  )
}

function Chevron() {
  return (
    <svg className="ui-tcc__chevron" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3.5 5.25 6 7.75l2.5-2.5" />
    </svg>
  )
}

function WrenchIcon() {
  return (
    <svg viewBox="0 0 16 16">
      <path d="M10.2 2.4a3.5 3.5 0 0 0-4.3 4.6L2.6 10.3a1.4 1.4 0 0 0 2 2L7.9 9a3.5 3.5 0 0 0 4.6-4.3l-2 2-1.6-.4-.4-1.6 1.7-2.3Z" />
    </svg>
  )
}

function useStopwatch(
  running: boolean,
  startedAtMs: number | undefined,
  accumulate: boolean
) {
  const start = useRef<number | null>(null)
  const base = useRef(0)
  const [ms, setMs] = useState<number | null>(null)
  useEffect(() => {
    if (!running) {
      if (start.current !== null) {
        base.current += Date.now() - start.current
        start.current = null
        setMs(base.current)
      }
      return
    }
    if (!accumulate) base.current = 0
    start.current = startedAtMs ?? Date.now()
    const tick = () =>
      setMs(base.current + Date.now() - (start.current ?? Date.now()))
    tick()
    const t = window.setInterval(tick, 100)
    return () => window.clearInterval(t)
  }, [running, startedAtMs, accumulate])
  return ms
}

function formatMs(ms: number, live: boolean) {
  if (!live && ms < 1000) return `${Math.max(1, Math.round(ms))}ms`
  if (ms < 60_000) return `${(Math.floor(ms / 100) / 10).toFixed(1)}s`
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`
}

function prettyJsonOrUndefined(text: string): string | undefined {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return undefined
  }
}

function toText(value: unknown): { text: string; json: boolean } {
  if (typeof value === "string") {
    const t = value.trim()
    if (t.startsWith("{") || t.startsWith("[")) {
      const pretty = prettyJsonOrUndefined(t)
      if (pretty !== undefined) return { text: pretty, json: true }
    }
    return { text: value, json: false }
  }
  try {
    const s = JSON.stringify(value, null, 2)
    return s === undefined
      ? { text: String(value), json: false }
      : { text: s, json: true }
  } catch {
    return { text: String(value), json: false }
  }
}

const TOKEN =
  /("(?:[^"\\]|\\.)*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

function highlight(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = new RegExp(TOKEN.source, "g")
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] && m[2]) {
      out.push(
        <span key={m.index} className="ui-tcc__t-key">
          {m[1]}
        </span>,
        m[2]
      )
    } else {
      const kind = m[1] ? "str" : /^[tfn]/.test(m[0]) ? "lit" : "num"
      out.push(
        <span key={m.index} className={`ui-tcc__t-${kind}`}>
          {m[0]}
        </span>
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
