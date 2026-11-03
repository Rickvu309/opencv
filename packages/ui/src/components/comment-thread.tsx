"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react"

export type ThreadAuthor = {
  name: string
  avatar?: ReactNode | string
  assistant?: boolean
}

export type ThreadMessage = {
  id: string
  author: ThreadAuthor
  createdAt: Date | number
  text: string
  status?: string
  details?: string[]
}

export type CommentThreadProps = {
  title?: string
  messages: ThreadMessage[]
  currentUser: ThreadAuthor
  assistant?: ThreadAuthor
  onReply?: (
    text: string
  ) => ThreadMessage | Promise<ThreadMessage | void> | void
  onClose?: () => void
  className?: string
}

const timestamp = () => Date.now()

function ago(time: number, now: number) {
  const s = Math.max(0, Math.round((now - time) / 1000))
  if (s < 45) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m}min ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}

export function CommentThread({
  title = "Comment",
  messages: initial,
  currentUser,
  assistant,
  onReply,
  onClose,
  className,
}: CommentThreadProps) {
  const [messages, setMessages] = useState(initial)
  const [firstIds] = useState(
    () => new Set(initial.filter((m) => m.author.assistant).map((m) => m.id))
  )
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [draft, setDraft] = useState("")
  const [thinking, setThinking] = useState(false)
  const [now, setNow] = useState(() => timestamp())
  const listRef = useRef<HTMLDivElement>(null)
  const morphRef = useSmoothHeight(listRef)

  useEffect(() => {
    const t = window.setInterval(() => setNow(timestamp()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages.length, thinking])

  const send = async () => {
    const text = draft.trim()
    if (!text || thinking) return
    setDraft("")
    setNow(timestamp())
    lockHeight(true)
    setMessages((m) => [
      ...m,
      {
        id: `m-${timestamp()}`,
        author: currentUser,
        createdAt: timestamp(),
        text,
      },
    ])
    const answer = onReply?.(text)
    if (!answer) return
    setThinking(true)
    try {
      const reply = await answer
      if (reply)
        setMessages((m) => [...m, { ...reply, createdAt: timestamp() }])
    } finally {
      setThinking(false)
      setNow(timestamp())
    }
  }

  const lockHeight = (on: boolean) => {
    const list = listRef.current
    if (list) list.style.maxHeight = on ? `${list.offsetHeight}px` : ""
  }

  const toggle = (id: string) => {
    lockHeight(false)
    setOpen((o) => {
      const next = new Set(o)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <style href="ui-comment-thread" precedence="default">
        {css}
      </style>
      <section
        data-slot="comment-thread"
        className={["ui-ct", className].filter(Boolean).join(" ")}
        aria-label={title}
      >
        <header className="ui-ct__head">
          <h3 className="ui-ct__title">{title}</h3>
          <span className="ui-ct__count">
            {messages.length} {messages.length === 1 ? "message" : "messages"}
          </span>
          {onClose && (
            <button
              type="button"
              className="ui-ct__icon-btn"
              aria-label="Close comment"
              onClick={onClose}
            >
              <Icon d="m4 4 8 8M12 4l-8 8" />
            </button>
          )}
        </header>

        <div className="ui-ct__card ui-ct__morph" ref={morphRef}>
          <div className="ui-ct__scroll" ref={listRef} aria-live="polite">
            {messages.map((m) => {
              const isOpen = open.has(m.id)
              const command = /^\/edit\b/i.test(m.text.trim())
              return (
                <article
                  key={m.id}
                  className="ui-ct__msg"
                  data-delayed={firstIds.has(m.id) || undefined}
                >
                  <div className="ui-ct__meta">
                    <Avatar author={m.author} />
                    <span className="ui-ct__name">{m.author.name}</span>
                    <time
                      className="ui-ct__time"
                      dateTime={new Date(m.createdAt).toISOString()}
                    >
                      {ago(+m.createdAt, now)}
                    </time>
                  </div>
                  {m.text && (
                    <p className="ui-ct__text">
                      {command ? (
                        <>
                          <span className="ui-ct__command">/Edit</span>{" "}
                          {m.text.trim().replace(/^\/edit\s*/i, "")}
                        </>
                      ) : (
                        m.text
                      )}
                    </p>
                  )}
                  {m.status && (
                    <div className="ui-ct__status">
                      <button
                        type="button"
                        className="ui-ct__status-btn"
                        aria-expanded={isOpen}
                        disabled={!m.details?.length}
                        onClick={() => toggle(m.id)}
                      >
                        <span className="ui-ct__check">
                          <Icon d="m4 8.3 2.6 2.6L12 5.4" size={12} />
                        </span>
                        {m.status}
                        {!!m.details?.length && (
                          <span className="ui-ct__chevron">
                            <Icon d="m4.5 6.25 3.5 3.5 3.5-3.5" size={14} />
                          </span>
                        )}
                      </button>
                      {!!m.details?.length && (
                        <div
                          className="ui-ct__details"
                          data-open={isOpen || undefined}
                          inert={!isOpen}
                        >
                          <ul>
                            {m.details.map((d, i) => (
                              <li key={d} style={{ "--i": i } as CSSProperties}>
                                {d}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
            {thinking && assistant && (
              <article
                className="ui-ct__msg"
                aria-label={`${assistant.name} is thinking`}
              >
                <div className="ui-ct__meta">
                  <Avatar author={assistant} />
                  <span className="ui-ct__name">{assistant.name}</span>
                </div>
                <p className="ui-ct__thinking">Thinking…</p>
              </article>
            )}
          </div>
        </div>

        {onReply && (
          <form
            className="ui-ct__composer"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <input
              className="ui-ct__input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                assistant ? `Reply, or ask @${assistant.name}…` : "Add comment…"
              }
              aria-label="Reply"
            />
            <button
              type="submit"
              className="ui-ct__send"
              aria-label="Send reply"
              disabled={!draft.trim() || thinking}
            >
              <Icon d="M8 13V3M3.5 7.5 8 3l4.5 4.5" size={14} />
            </button>
          </form>
        )}
      </section>
    </>
  )
}

function Avatar({ author }: { author: ThreadAuthor }) {
  if (author.avatar && typeof author.avatar !== "string")
    return <span className="ui-ct__avatar">{author.avatar}</span>
  if (typeof author.avatar === "string") {
    return (
      <img
        className="ui-ct__avatar"
        src={author.avatar}
        alt=""
        width={24}
        height={24}
        loading="lazy"
      />
    )
  }
  return (
    <span className="ui-ct__avatar ui-ct__avatar--initials" aria-hidden="true">
      {author.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")}
    </span>
  )
}

export function AssistantMark() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="var(--primary)" />
    </svg>
  )
}

const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg
    viewBox="0 0 16 16"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
)

function useSmoothHeight(inner: RefObject<HTMLElement | null>) {
  const outer = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    const sync = () => {
      o.style.height = `${i.offsetHeight}px`
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(i)
    const frame = requestAnimationFrame(() => o.setAttribute("data-smooth", ""))
    return () => {
      ro.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [inner])
  return outer
}

const css = `
.ui-ct {
  --ui-ct-tray: var(--muted);
  --ui-ct-card: var(--card);
  --ui-ct-ink: var(--foreground);
  --ui-ct-text: var(--foreground);
  --ui-ct-muted: var(--muted-foreground);
  --ui-ct-accent: var(--ring);
  --ui-ct-ok: var(--primary);
  --ui-ct-accent-text: var(--foreground);
  --ui-ct-border: var(--border);
  --ui-ct-shadow: 0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent);
  --ui-ct-hover: color-mix(in oklab, var(--foreground) 5%, transparent);
  --ui-ct-row-hover: var(--accent);
  --ui-ct-initials: var(--muted);
  --ui-ct-dot: var(--border);
  --ui-ct-subtle: var(--muted-foreground);
  --ui-ct-avatar-ring: color-mix(in oklab, var(--foreground) 6%, transparent);
  --ui-ct-ease: var(--ease-micro);
  box-sizing: border-box;
  width: 100%;
  max-width: 420px;
  background: var(--ui-ct-tray);
  padding: 6px;
  border-radius: 22px;
  font-family: inherit;
  color: var(--ui-ct-ink);
  -webkit-font-smoothing: antialiased;
}
.ui-ct *, .ui-ct *::before, .ui-ct *::after { box-sizing: border-box; }
.ui-ct button { margin: 0; font: inherit; color: inherit; cursor: pointer; }
.ui-ct button:focus-visible { outline: 2px solid var(--ui-ct-accent); outline-offset: 2px; }

.ui-ct__head {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 6px 10px 6px 18px;
}
.ui-ct__title { margin: 0; font-size: 15px; font-weight: 500; line-height: 22px; }
.ui-ct__count { margin-right: auto; font-size: 12.5px; color: var(--ui-ct-muted); }
.ui-ct__icon-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--ui-ct-muted) !important;
  transition: background-color var(--duration-micro) var(--ease-micro), color var(--duration-micro) var(--ease-micro);
}
.ui-ct__icon-btn:hover { background: var(--ui-ct-hover); color: var(--ui-ct-ink) !important; }

.ui-ct__card {
  background: var(--ui-ct-card);
  border: 1px solid var(--ui-ct-border);
  border-radius: 16px;
  box-shadow: var(--ui-ct-shadow);
}
.ui-ct__scroll {
  display: grid;
  gap: 18px;
  align-content: start;
  min-height: 0px;
  max-height: 340px;
  padding: 16px 18px 18px;
  overflow-y: auto;
  scrollbar-width: thin;
}
.ui-ct__msg { --ui-ct-d: 0ms; }
.ui-ct__msg[data-delayed] { --ui-ct-d: 700ms; }
.ui-ct__msg > * { animation: ui-ct-in var(--duration-panel) var(--ease-panel) both; animation-delay: var(--ui-ct-d); }
.ui-ct__msg > :nth-child(2) { animation-delay: calc(var(--ui-ct-d) + 80ms); }
.ui-ct__msg > :nth-child(3) { animation-delay: calc(var(--ui-ct-d) + 160ms); }
.ui-ct__meta { display: flex; align-items: center; gap: 9px; }
.ui-ct__avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  overflow: hidden;
}
img.ui-ct__avatar { box-shadow: 0 0 0 1px var(--ui-ct-avatar-ring); }
.ui-ct__avatar svg { width: 100%; height: 100%; }
.ui-ct__avatar--initials { background: var(--ui-ct-initials); font-size: 9px; font-weight: 600; color: var(--ui-ct-accent-text); }
.ui-ct__name { font-size: 14px; font-weight: 500; line-height: 20px; }
.ui-ct__time { margin-left: auto; font-size: 12.5px; color: var(--ui-ct-muted); font-variant-numeric: tabular-nums; }
.ui-ct__text { margin: 8px 0 0; font-size: 14px; line-height: 21px; color: var(--ui-ct-text); }
.ui-ct__command { color: var(--ui-ct-muted); }

.ui-ct__status { margin-top: 8px; }
.ui-ct__status-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 26px;
  padding: 0 6px 0 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font-size: 14px !important;
  transition: background-color var(--duration-micro) var(--ease-micro);
}
.ui-ct .ui-ct__status-btn { margin-left: -4px; }
.ui-ct__status-btn:hover:not(:disabled) { background: var(--ui-ct-row-hover); }
.ui-ct__status-btn:disabled { cursor: default; }
.ui-ct__check {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--ui-ct-ok);
  color: var(--primary-foreground);
}
.ui-ct__chevron { display: grid; color: var(--ui-ct-muted); transition: transform var(--duration-panel) var(--ease-panel); }
.ui-ct__status-btn[aria-expanded="true"] .ui-ct__chevron { transform: rotate(180deg); }
.ui-ct__details {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--duration-panel) var(--ease-panel);
}
.ui-ct__details[data-open] { grid-template-rows: 1fr; }
.ui-ct__details ul {
  min-height: 0;
  overflow: hidden;
  margin: 0;
  padding: 0 0 0 28px;
  list-style: none;
}
.ui-ct__details li {
  position: relative;
  margin-top: 6px;
  font-size: 13px;
  line-height: 19px;
  color: var(--ui-ct-muted);
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity var(--duration-micro) var(--ease-micro), transform var(--duration-micro) var(--ease-micro);
}
.ui-ct__details[data-open] li {
  opacity: 1;
  transform: none;
  transition-duration: var(--duration-panel), var(--duration-panel);
  transition-delay: calc(60ms + var(--i, 0) * 60ms);
}
.ui-ct__details li:first-child { margin-top: 5px; }
.ui-ct__details li::before {
  content: "";
  position: absolute;
  left: -16.625px;
  top: -3px;
  width: 10.5px;
  height: 13px;
  border-left: 1.25px solid var(--ui-ct-dot);
  border-bottom: 1.25px solid var(--ui-ct-dot);
  border-bottom-left-radius: 5px;
}
.ui-ct__details li:first-child::before {
  top: -5px;
  height: 15px;
}

.ui-ct__thinking {
  display: inline-block;
  margin: 8px 0 0;
  font-size: 14px;
  background: linear-gradient(90deg, var(--ui-ct-subtle) 0%, var(--ui-ct-subtle) 35%, var(--foreground) 50%, var(--ui-ct-subtle) 65%, var(--ui-ct-subtle) 100%);
  background-size: 300% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ui-ct-shine 1.6s linear infinite;
}

.ui-ct__composer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 9px 9px 18px;
}
.ui-ct__input {
  flex: 1;
  min-width: 0;
  height: 32px;
  border: 0;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 14px;
  color: var(--ui-ct-ink);
}
.ui-ct__input::placeholder { color: var(--ui-ct-subtle); }
.ui-ct__send {
  display: grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 0 0 1px var(--primary), 0 2px 4px color-mix(in oklab, var(--foreground) 10%, transparent);
  color: var(--primary-foreground) !important;
  transition: opacity var(--duration-micro) var(--ease-micro), transform var(--duration-micro) var(--ease-micro);
}
.ui-ct__send:disabled { opacity: 0.3; cursor: default; }
.ui-ct__send:not(:disabled):active { transform: scale(0.94); }

@keyframes ui-ct-in { from { opacity: 0; transform: translateY(4px); } }
@keyframes ui-ct-shine { from { background-position: 100% 0; } to { background-position: 0% 0; } }
@media (prefers-reduced-motion: reduce) {
  .ui-ct__msg > *, .ui-ct__thinking { animation: none; }
  .ui-ct__details, .ui-ct__details li, .ui-ct__chevron { transition: none; }
}

.ui-ct__morph { overflow: hidden; }
.ui-ct__morph[data-smooth] { transition: height var(--duration-panel) cubic-bezier(0.22, 1, 0.36, 1); }
@media (prefers-reduced-motion: reduce) { .ui-ct__morph[data-smooth] { transition: none; } }


.ui-ct input:not([type="checkbox"]):not([type="radio"]):focus-visible,
.ui-ct textarea:focus-visible,
.ui-ct [contenteditable]:focus-visible { outline: none; }
`
