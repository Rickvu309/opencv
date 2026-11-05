"use client"

import { copyText } from "./copy-button"
import { css } from "./message-actions-styles"

import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react"

export type MessageActionKey = "copy" | "regenerate" | "feedback"
export type FeedbackKind = "up" | "down"

export type MessageActionsProps = {
  text?: string
  actions?: MessageActionKey[]
  versions?: number | string[]
  version?: number
  defaultVersion?: number
  onVersionChange?: (index: number) => void
  onCopy?: (text?: string) => void
  onRegenerate?: () => void
  regenerating?: boolean
  regenerateDisabled?: boolean
  feedback?: FeedbackKind | null
  feedbackDisabled?: boolean
  onFeedback?: (kind: FeedbackKind | null, reason?: string) => void
  reasons?: string[]
  quiet?: boolean
  label?: string
  className?: string
}

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

function Swap({
  id,
  children,
  className,
}: {
  id: string
  children: ReactNode
  className?: string
}) {
  type Line = { id: string; node: ReactNode }
  const last = useRef<Line>({ id, node: children })
  const [shownId, setShownId] = useState(id)
  const [out, setOut] = useState<Line | null>(null)
  if (shownId !== id) {
    setShownId(id)
    // eslint-disable-next-line react-hooks/refs -- vendored: the outgoing line is read once per change
    setOut(last.current)
  }
  // eslint-disable-next-line react-hooks/refs -- vendored: remembers the last line for the crossfade
  last.current = { id, node: children }
  useEffect(() => {
    if (!out) return
    const timer = window.setTimeout(() => setOut(null), 300)
    return () => window.clearTimeout(timer)
  }, [out])
  return (
    <span className={["ui-mac__swap", className].filter(Boolean).join(" ")}>
      {out && (
        <span
          key={`out-${out.id}`}
          className="ui-mac__swap-item"
          data-out=""
          aria-hidden="true"
        >
          {out.node}
        </span>
      )}
      <span key={id} className="ui-mac__swap-item">
        {children}
      </span>
    </span>
  )
}

const Glyph = ({ d, solid }: { d: string; solid?: boolean }) => (
  <svg
    viewBox="0 0 16 16"
    className="ui-mac__glyph"
    data-solid={solid || undefined}
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
)
const icons = {
  copy: "M5.5 2A1.5 1.5 0 0 0 4 3.5V4h5A3 3 0 0 1 12 7v5h.5a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 12.5 2h-7ZM3.5 5A1.5 1.5 0 0 0 2 6.5v6A1.5 1.5 0 0 0 3.5 14H9a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 9 5H3.5Z",
  check:
    "M1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0Zm8.9-1.2a.5.5 0 0 0-.8-.6L7.44 9.23 6.35 8.15a.5.5 0 1 0-.7.7l1.5 1.5a.5.5 0 0 0 .76-.06l2.5-3.5Z",
  tick: "M3.5 8.5 6.5 11.5 12.5 4.5",
  redo: "M13 8a5 5 0 1 1-1.46-3.54M13 2.5v2.5h-2.5",
  thumb:
    "M4.5 7v6.5H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h1.5Zm1 6.5h5.95a1.5 1.5 0 0 0 1.47-1.2l.86-4.3A1.5 1.5 0 0 0 12.31 6.2H9.5l.42-2.08A1.4 1.4 0 0 0 7.3 3.1L5.5 6.8v6.7Z",
  next: "M10.85 7.65a.5.5 0 0 1 0 .7L7.2 12a.5.5 0 0 1-.7-.7L9.79 8 6.5 4.7a.5.5 0 1 1 .7-.7l3.65 3.65Z",
  close: "m4.5 4.5 7 7m0-7-7 7",
}

const DEFAULT_ACTIONS: MessageActionKey[] = ["copy", "regenerate", "feedback"]
const DEFAULT_REASONS: string[] = []

export function MessageActions({
  text,
  actions = DEFAULT_ACTIONS,
  versions,
  version,
  defaultVersion,
  onVersionChange,
  onCopy,
  onRegenerate,
  regenerating = false,
  regenerateDisabled = false,
  feedback = null,
  feedbackDisabled = false,
  onFeedback,
  reasons = DEFAULT_REASONS,
  quiet = true,
  label = "Message actions",
  className,
}: MessageActionsProps) {
  const uid = useId()
  const count = Math.max(
    1,
    typeof versions === "number"
      ? Math.floor(versions)
      : (versions?.length ?? 1)
  )

  const [inner, setInner] = useState(() =>
    Math.min(count - 1, Math.max(0, defaultVersion ?? count - 1))
  )
  const [seenCount, setSeenCount] = useState(count)
  const [vote, setVote] = useState<FeedbackKind | null>(feedback)
  const [seenFeedback, setSeenFeedback] = useState(feedback)
  if (seenFeedback !== feedback) {
    setSeenFeedback(feedback)
    setVote(feedback)
  }
  const [panel, setPanel] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const [other, setOther] = useState("")
  const [sent, setSent] = useState(false)
  if (seenCount !== count) {
    if (count > seenCount) {
      setInner(count - 1)
      setVote(null)
      setPanel(false)
    }
    setSeenCount(count)
  }
  const index = Math.min(count - 1, Math.max(0, version ?? inner))
  const goTo = (i: number) => {
    const next = Math.min(count - 1, Math.max(0, i))
    if (next === index) return
    if (version === undefined) setInner(next)
    onVersionChange?.(next)
    announce(`Version ${next + 1} of ${count}`)
  }

  const [status, setStatus] = useState("")
  const announce = (s: string) =>
    setStatus((old) => (old === s ? `${s}\u00a0` : s))

  const [copied, setCopied] = useState(0)
  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(0), 1600)
    return () => window.clearTimeout(t)
  }, [copied])
  const copy = () => {
    if (text !== undefined) void copyText(text)
    onCopy?.(text)
    setCopied(Date.now())
    announce("Copied")
  }

  const [spin, setSpin] = useState(0)
  const regenerate = () => {
    setSpin((s) => s + 1)
    onRegenerate?.()
    announce("Regenerating")
  }

  const thumbsUp = () => {
    if (vote === "up") {
      setVote(null)
      onFeedback?.(null)
      return
    }
    setVote("up")
    setPanel(false)
    onFeedback?.("up")
    announce("Marked as good response")
  }
  const thumbsDown = () => {
    if (vote === "down") {
      setVote(null)
      setPanel(false)
      onFeedback?.(null)
      return
    }
    setVote("down")
    setPanel(reasons.length > 0)
    setSent(false)
    setReason(null)
    setOther("")
    onFeedback?.("down")
    announce(
      reasons.length > 0
        ? "Marked as bad response. Tell us what went wrong below"
        : "Marked as bad response"
    )
  }
  const send = () => {
    if (!reason || sent) return
    onFeedback?.("down", reason === "Other" ? other.trim() || "Other" : reason)
    setSent(true)
    announce("Thanks for the feedback")
  }
  useEffect(() => {
    if (!sent) return
    const t = window.setTimeout(() => setPanel(false), reduced() ? 1200 : 1500)
    return () => window.clearTimeout(t)
  }, [sent])
  const downRef = useRef<HTMLButtonElement>(null)
  const closePanel = () => {
    setPanel(false)
    downRef.current?.focus()
  }

  const active = Boolean(copied) || panel || regenerating

  const button = (o: {
    key: string
    tip: string
    labelText: string
    onClick: () => void
    children: ReactNode
    pressed?: boolean
    flash?: boolean
    extra?: Record<string, string | undefined>
    expanded?: boolean
    controls?: string
    refEl?: Ref<HTMLButtonElement>
    disabled?: boolean
  }) => (
    <span
      className="ui-mac__item"
      key={o.key}
      data-flash={o.flash ? "" : undefined}
    >
      <button
        ref={o.refEl}
        type="button"
        className={`ui-mac__btn ui-mac__btn--${o.key}`}
        aria-label={o.labelText}
        aria-pressed={o.pressed}
        aria-expanded={o.expanded}
        aria-controls={o.controls}
        disabled={o.disabled}
        onClick={o.onClick}
        {...o.extra}
      >
        {o.children}
      </button>
      <span className="ui-mac__tip" aria-hidden="true">
        <Swap id={o.tip}>{o.tip}</Swap>
      </span>
    </span>
  )

  const parts: ReactNode[] = actions.map((key) => {
    if (key === "copy")
      return button({
        key: "copy",
        tip: copied ? "Copied" : "Copy",
        labelText: copied ? "Copied" : "Copy",
        onClick: copy,
        flash: Boolean(copied),
        extra: { "data-done": copied ? "" : undefined },
        children: (
          <span className="ui-mac__icon ui-mac__morph">
            <span className="ui-mac__layer" data-on={copied ? undefined : ""}>
              <Glyph d={icons.copy} solid />
            </span>
            <span
              className="ui-mac__layer ui-mac__layer--check"
              data-on={copied ? "" : undefined}
            >
              <Glyph d={icons.check} solid />
            </span>
          </span>
        ),
      })
    if (key === "regenerate")
      return (
        <span className="ui-mac__regen" key="regenerate">
          {button({
            key: "regenerate",
            tip: regenerating ? "Writing…" : "Regenerate",
            labelText: "Regenerate",
            disabled: regenerateDisabled,
            onClick: regenerate,
            extra: { "data-busy": regenerating ? "" : undefined },
            children: (
              <span className="ui-mac__icon">
                <span
                  className="ui-mac__spin"
                  key={spin}
                  data-spin={spin ? "" : undefined}
                >
                  <Glyph d={icons.redo} />
                </span>
              </span>
            ),
          })}
          <span
            className="ui-mac__versions"
            data-open={count > 1 ? "" : undefined}
            inert={count < 2}
          >
            <span
              className="ui-mac__versions-clip"
              role="group"
              aria-label="Versions"
            >
              <button
                type="button"
                className="ui-mac__step"
                data-dir="prev"
                aria-label="Previous version"
                disabled={index === 0}
                onClick={() => goTo(index - 1)}
              >
                <Glyph d={icons.next} solid />
              </button>
              <span
                className="ui-mac__count"
                aria-label={`Version ${index + 1} of ${count}`}
              >
                <Swap id={String(index)} className="ui-mac__count-now">
                  {index + 1}
                </Swap>
                <span aria-hidden="true">/</span>
                <Swap id={String(count)}>{count}</Swap>
              </span>
              <button
                type="button"
                className="ui-mac__step"
                data-dir="next"
                aria-label="Next version"
                disabled={index >= count - 1}
                onClick={() => goTo(index + 1)}
              >
                <Glyph d={icons.next} solid />
              </button>
            </span>
          </span>
        </span>
      )
    if (key === "feedback")
      return (
        <Fragment key="feedback">
          {button({
            key: "up",
            tip: vote === "up" ? "Thanks!" : "Good response",
            labelText: "Good response",
            disabled: feedbackDisabled,
            pressed: vote === "up",
            onClick: thumbsUp,
            children: (
              <span className="ui-mac__icon ui-mac__thumb">
                <Glyph d={icons.thumb} solid />
              </span>
            ),
          })}
          {button({
            key: "down",
            tip: "Bad response",
            labelText: "Bad response",
            disabled: feedbackDisabled,
            pressed: vote === "down",
            expanded: reasons.length > 0 ? panel : undefined,
            controls: reasons.length > 0 ? `${uid}-feedback` : undefined,
            onClick: thumbsDown,
            refEl: downRef,
            children: (
              <span className="ui-mac__icon ui-mac__thumb">
                <Glyph d={icons.thumb} solid />
              </span>
            ),
          })}
        </Fragment>
      )
    return null
  })

  const onPanelKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation()
      closePanel()
    }
  }

  return (
    <div
      data-slot="message-actions"
      className={["ui-mac", className].filter(Boolean).join(" ")}
      data-quiet={quiet ? "" : undefined}
      data-active={active ? "" : undefined}
    >
      <style href="ui-message-actions-clean" precedence="default">
        {css}
      </style>

      <div className="ui-mac__bar" role="group" aria-label={label}>
        {parts}
      </div>

      {actions.includes("feedback") && reasons.length > 0 && (
        <div
          id={`${uid}-feedback`}
          className="ui-mac__fold"
          data-open={panel ? "" : undefined}
          inert={!panel}
        >
          <div className="ui-mac__clip">
            <div
              className="ui-mac__panel"
              role="group"
              aria-labelledby={`${uid}-ask`}
              onKeyDown={onPanelKey}
            >
              <div className="ui-mac__panel-head">
                <span id={`${uid}-ask`} className="ui-mac__ask">
                  What went wrong?
                </span>
                <button
                  type="button"
                  className="ui-mac__close"
                  aria-label="Close feedback"
                  onClick={closePanel}
                >
                  <Glyph d={icons.close} />
                </button>
              </div>
              <div className="ui-mac__chips">
                {reasons.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="ui-mac__chip"
                    aria-pressed={reason === r}
                    disabled={sent}
                    onClick={() => setReason(reason === r ? null : r)}
                  >
                    {r}
                  </button>
                ))}
                <button
                  type="button"
                  className="ui-mac__send"
                  data-sent={sent ? "" : undefined}
                  disabled={!reason}
                  aria-disabled={sent || undefined}
                  onClick={send}
                >
                  <Swap id={sent ? "sent" : "send"}>
                    {sent ? (
                      <>
                        <Glyph d={icons.tick} />
                        Thanks!
                      </>
                    ) : (
                      "Send"
                    )}
                  </Swap>
                </button>
              </div>
              {reasons.includes("Other") && (
                <div
                  className="ui-mac__fold"
                  data-open={reason === "Other" && !sent ? "" : undefined}
                  inert={reason !== "Other" || sent}
                >
                  <div className="ui-mac__clip">
                    <input
                      className="ui-mac__input"
                      value={other}
                      placeholder="Tell us more (optional)"
                      aria-label="What went wrong, in your words"
                      onChange={(e) => setOther(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") send()
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <span className="ui-mac__sr" aria-live="polite">
        {status}
      </span>
    </div>
  )
}
