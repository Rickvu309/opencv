import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  CircleCheck,
  Circle,
  Loader2,
  Info,
  CircleAlert,
  TriangleAlert,
  X,
} from "lucide-react"
import { cn } from "./cn"

/** Usage as a share, never a count. Turns red only at the limit. */
export function Meter({
  label,
  value,
  caption,
  className,
}: {
  label: string
  value: number
  caption?: string
  className?: string
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  const tone = pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-fg"
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between">
        <span className="font-medium">{label}</span>
        <span className={pct >= 100 ? "text-danger" : "text-fg-2"}>
          {caption ?? (pct >= 100 ? "Limit reached" : `${pct}% used`)}
        </span>
      </div>
      <div
        className="bg-chip h-1.5 rounded-full"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn("h-full rounded-full", tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/** The bar alone, for rows that show the label and caption themselves. */
export function UsageBar({
  value,
  label,
  className,
}: {
  value: number
  label: string
  className?: string
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div
      className={cn("bg-chip h-1.5 rounded-full", className)}
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn(
          "h-full rounded-full",
          pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-fg"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export interface Step {
  label: string
  meta?: string
  state: "done" | "active" | "pending"
}

/** Coach shows what it is doing: done, active, pending. */
export function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-2 border-l border-border pl-3">
      {steps.map((s) => (
        <li key={s.label} className="flex items-center gap-2">
          {s.state === "done" && (
            <CircleCheck className="text-fg size-3.5" aria-hidden />
          )}
          {s.state === "active" && (
            <Loader2 className="text-fg-2 size-3.5 animate-spin" aria-hidden />
          )}
          {s.state === "pending" && (
            <Circle className="text-placeholder size-3.5" aria-hidden />
          )}
          <span
            className={cn(
              s.state === "active" && "font-medium",
              s.state === "pending" && "text-fg-3"
            )}
          >
            {s.label}
          </span>
          {s.meta && <span className="text-small text-fg-3">{s.meta}</span>}
        </li>
      ))}
    </ol>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      className={cn("rounded-chip bg-chip block animate-pulse", className)}
      aria-hidden
    />
  )
}

type BannerTone = "info" | "success" | "warning" | "danger"
const BANNER: Record<
  BannerTone,
  { bg: string; ic: string; Icon: typeof Info }
> = {
  info: { bg: "bg-info-soft", ic: "text-[#3A5FD9]", Icon: Info },
  success: { bg: "bg-success-soft", ic: "text-[#2E8A5C]", Icon: CircleCheck },
  warning: { bg: "bg-warning-soft", ic: "text-[#8A6A00]", Icon: TriangleAlert },
  danger: { bg: "bg-danger-soft", ic: "text-[#C53F3F]", Icon: CircleAlert },
}

/** Inline notice at the top of a page or card. One line, one action. */
export function Banner({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: BannerTone
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  const t = BANNER[tone]
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-card flex items-center gap-3 px-3.5 py-3", t.bg)}
    >
      <t.Icon className={cn("size-4 shrink-0", t.ic)} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium">{title}</span>
        {children && (
          <span className="text-fg-2 text-[12.5px]">{children}</span>
        )}
      </div>
      {action}
    </div>
  )
}

/** Empty, error, no results and loading. One sentence, one action. */
export function StateMessage({
  icon,
  title,
  children,
  action,
  tone = "neutral",
}: {
  icon: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
  tone?: "neutral" | "error"
}) {
  return (
    <div className="flex w-[360px] max-w-full flex-col items-center gap-2 py-7 text-center">
      <span
        className={cn(
          "rounded-card bg-chip mb-1 inline-flex size-10 items-center justify-center [&_svg]:size-[18px]",
          tone === "error" ? "text-danger" : "text-fg-2"
        )}
      >
        {icon}
      </span>
      <h2 className="text-[14px] font-semibold">{title}</h2>
      {children && <p className="text-fg-2">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

interface ToastItem {
  id: number
  message: string
  tone: "success" | "info" | "error"
  action?: { label: string; onClick: () => void }
}
const ToastContext = createContext<(t: Omit<ToastItem, "id">) => void>(() => {})

/** Bottom center, one fact. 4 seconds, 8 with an Undo style action. Errors stay until dismissed. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const next = useRef(1)
  const push = useCallback(
    (t: Omit<ToastItem, "id">) =>
      setItems((list) => [...list, { ...t, id: next.current++ }]),
    []
  )
  const dismiss = (id: number) =>
    setItems((list) => list.filter((x) => x.id !== id))
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-14 z-50 flex flex-col items-center gap-2"
      >
        {items.map((t) => (
          <Toast key={t.id} item={t} onDone={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function Toast({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    if (item.tone === "error") return
    const h = setTimeout(() => done.current(), item.action ? 8000 : 4000)
    return () => clearTimeout(h)
  }, [item.tone, item.action])
  const Icon =
    item.tone === "success"
      ? CircleCheck
      : item.tone === "error"
        ? CircleAlert
        : Info
  const ic =
    item.tone === "success"
      ? "text-success"
      : item.tone === "error"
        ? "text-danger"
        : "text-[#9DB0F2]"
  return (
    <div className="rounded-card pointer-events-auto flex h-10 items-center gap-2.5 bg-[#1A1A1A] pr-1.5 pl-3 font-medium text-white shadow-[0_8px_24px_rgb(0_0_0/0.2)]">
      <Icon className={cn("size-[15px]", ic)} aria-hidden />
      {item.message}
      {item.action && (
        <button
          onClick={() => {
            item.action!.onClick()
            onDone()
          }}
          className="rounded-btn h-7 bg-white/10 px-2.5 hover:bg-white/15"
        >
          {item.action.label}
        </button>
      )}
      {item.tone === "error" && (
        <button
          onClick={onDone}
          aria-label="Dismiss"
          className="rounded-btn inline-flex size-7 items-center justify-center hover:bg-white/10"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export const useToast = () => useContext(ToastContext)
