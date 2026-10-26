import type { ReactNode } from "react"
import { ChevronRight, X } from "lucide-react"
import { cn } from "./cn"

type Tone = "neutral" | "success" | "warning" | "danger" | "info"
const TONE: Record<Tone, string> = {
  neutral: "bg-chip text-fg-2",
  success: "bg-success-soft text-[#2E8A5C]",
  warning: "bg-warning-soft text-[#8A6A00]",
  danger: "bg-danger-soft text-[#C53F3F]",
  info: "bg-info-soft text-[#3A5FD9]",
}

/** Short status words. Two words at most. */
export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: Tone
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[5px] px-[7px] text-[11.5px] font-medium",
        TONE[tone]
      )}
    >
      {children}
    </span>
  )
}

/** Properties and filters. The icon may carry color; the label never does. */
export function Chip({
  icon,
  children,
  selected,
  onRemove,
  className,
}: {
  icon?: ReactNode
  children: ReactNode
  selected?: boolean
  onRemove?: () => void
  className?: string
}) {
  return (
    <span
      className={cn(
        "rounded-row text-small inline-flex h-6 items-center gap-[5px] px-2 font-medium ring-1 ring-inset",
        selected ? "bg-active ring-border-strong" : "bg-surface ring-border",
        className
      )}
    >
      {icon && <span className="inline-flex [&_svg]:size-[13px]">{icon}</span>}
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label="Remove"
          className="text-fg-3 hover:text-fg"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-chip bg-chip text-fg-3 inline-flex h-[18px] items-center px-[5px] font-sans text-[11px]">
      {children}
    </kbd>
  )
}

/** On reads "Enabled", off reads "Disabled". Dot variants for connections. */
export function Status({
  kind,
  chevron = true,
}: {
  kind: "enabled" | "disabled" | "connected" | "expired"
  chevron?: boolean
}) {
  const text =
    kind === "expired"
      ? "Access expired"
      : kind === "disabled"
        ? "Disabled"
        : "Enabled"
  const dot =
    kind === "connected" ? "bg-success" : kind === "expired" ? "bg-fg-3" : null
  return (
    <span
      className={cn(
        "text-body inline-flex items-center gap-[5px]",
        kind === "disabled" ? "text-fg-3" : "text-fg-2"
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dot)} />}
      {text}
      {chevron && !dot && (
        <ChevronRight className="text-fg-3 size-3.5" aria-hidden />
      )}
    </span>
  )
}

export function Avatar({
  initials,
  src,
  size = 24,
  className,
}: {
  initials: string
  src?: string
  size?: 20 | 22 | 24 | 28 | 32 | 44
  className?: string
}) {
  return (
    <span
      className={cn(
        "bg-chip text-fg-2 inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initials
      )}
    </span>
  )
}

/** One icon in a soft square. Used at the start of settings rows. */
export function IconTile({
  children,
  size = 32,
}: {
  children: ReactNode
  size?: 32 | 36 | 40
}) {
  return (
    <span
      className="rounded-tile bg-chip text-fg-2 inline-flex shrink-0 items-center justify-center [&_svg]:size-4"
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  )
}

/** One brand logo on white. Brand logos are never recolored. */
export function LogoTile({
  src,
  alt,
  size = 32,
}: {
  src: string
  alt: string
  size?: 20 | 32 | 44 | 64
}) {
  return (
    <span
      className="bg-surface inline-flex shrink-0 items-center justify-center ring-[0.5px] ring-border"
      style={{
        width: size,
        height: size,
        borderRadius: size > 40 ? 14 : size > 24 ? 8 : 5,
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{ width: size * 0.6, height: size * 0.6 }}
        className="object-contain"
      />
    </span>
  )
}
