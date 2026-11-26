import type { ReactNode } from "react"
import { ChevronRight, type LucideIcon } from "lucide-react"
import { useNavigate } from "@tanstack/react-router"
import type { Profile } from "@workspace/domain/account"
import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  PageHeader,
  PageHeaderBack,
  PageHeaderLeading,
} from "@workspace/ui/components/page-header"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

import { DESKTOP_MEDIA_QUERY, useMediaQuery } from "@/lib/use-media-query.ts"
import { startPagePath } from "@/lib/product-paths.ts"

import {
  SETTINGS_SECTIONS,
  settingsSectionHref,
  type SettingsSectionId,
  type SettingsView,
} from "./sections.ts"
import { LOAD_ERROR } from "./settings-api.ts"

export function SettingsLayout({
  view,
  startPage,
  children,
}: {
  view: SettingsView
  startPage?: Profile["startPage"]
  children: ReactNode
}) {
  const desktop = useMediaQuery(DESKTOP_MEDIA_QUERY, true)
  return (
    <div
      data-slot="settings-layout"
      className="flex h-full min-h-0 flex-col overflow-x-hidden bg-background text-foreground"
    >
      {desktop ? null : (
        <PageHeader>
          <PageHeaderLeading>
            <PhoneBack href={startPagePath(startPage)} />
          </PageHeaderLeading>
          <SectionSelect current={view} />
        </PageHeader>
      )}
      <div
        data-slot="settings-body"
        className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-8 md:px-10 md:pt-14 md:pb-10"
      >
        <div
          data-slot="settings-column"
          className="@container/settings mx-auto flex w-full max-w-[640px] flex-col"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function PhoneBack({ href }: { href: string }) {
  const navigate = useNavigate()
  return (
    <PageHeaderBack
      href={href}
      onClick={(event) => {
        event.preventDefault()
        void navigate({ href })
      }}
    >
      Back to app
    </PageHeaderBack>
  )
}

function SectionSelect({ current }: { current: SettingsSectionId }) {
  const navigate = useNavigate()
  const label =
    SETTINGS_SECTIONS.find((item) => item.id === current)?.label ??
    "Preferences"
  return (
    <Select
      value={current}
      onValueChange={(value) => {
        if (!value) return
        const match = SETTINGS_SECTIONS.find((item) => item.id === value)
        if (match) void navigate({ href: settingsSectionHref(match.id) })
      }}
    >
      <SelectTrigger
        aria-label="Section"
        data-slot="settings-section-picker"
        className="ml-auto w-auto min-w-0 touch-manipulation border-transparent bg-transparent text-[15px] font-medium shadow-none data-[size=default]:max-md:h-11"
      >
        <SelectValue>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {SETTINGS_SECTIONS.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const ROW_INSET = {
  default: "px-4 py-3.5",
  wide: "px-5 py-3.5",
  tall: "px-5 py-4",
} as const

const ROW_GAP = {
  text: "gap-4",
  tile: "gap-3",
  avatar: "gap-3.5",
} as const

export function SettingsTitle({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div data-slot="settings-title" className="mb-7 flex flex-col gap-1.5">
      <h1 className="text-2xl font-semibold tracking-[-0.5px]">{title}</h1>
      {children ? (
        <p
          data-slot="settings-title-sub"
          className="text-ui text-muted-foreground"
        >
          {children}
        </p>
      ) : null}
    </div>
  )
}

export function SettingsSection({
  id,
  label,
  note,
  spacing = "card",
  className,
  children,
}: {
  id: string
  label: string
  note?: string
  spacing?: "card" | "grid"
  className?: string
  children: ReactNode
}) {
  return (
    <section
      data-slot="settings-section"
      data-section={id}
      aria-labelledby={`settings-section-${id}`}
      className={cn(
        "mb-7 flex flex-col",
        spacing === "grid" ? "gap-2.5" : "gap-2",
        className
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id={`settings-section-${id}`}
          data-slot="settings-section-head"
          className="text-ui font-medium text-muted-foreground"
        >
          {label}
        </h2>
        {note ? (
          <span className="text-ui text-muted-foreground">{note}</span>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export function SettingsCard({
  name,
  children,
  className,
}: {
  name?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      data-slot="settings-card"
      data-card={name}
      className={cn(
        "flex min-w-0 flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card",
        className
      )}
    >
      {children}
    </div>
  )
}

export function SettingsTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      aria-hidden
      data-slot="settings-tile"
      className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
    >
      <Icon className="size-4" />
    </span>
  )
}

export function SettingsRow({
  id,
  label,
  desc,
  leading,
  control,
  inset = "default",
  gap,
  onClick,
  disabled,
  error,
  errorId,
  stack = false,
}: {
  id?: string
  label: ReactNode
  desc?: ReactNode
  leading?: ReactNode
  control?: ReactNode
  inset?: keyof typeof ROW_INSET
  gap?: keyof typeof ROW_GAP
  onClick?: () => void
  disabled?: boolean
  error?: string
  errorId?: string
  stack?: boolean
}) {
  const labelId = id ? `settings-row-${id}-label` : undefined
  const messageId = errorId ?? (id ? `settings-row-${id}-error` : undefined)
  const body = (
    <>
      {leading}
      <span
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-0.5",
          stack &&
            "@max-[479px]/settings:w-full @max-[479px]/settings:flex-none"
        )}
      >
        <span
          id={labelId}
          data-slot="settings-row-label"
          className="text-ui leading-4 font-medium break-words"
        >
          {label}
        </span>
        {desc ? (
          <span
            data-slot="settings-row-desc"
            className={cn(
              "text-xs leading-4 break-words text-muted-foreground",
              stack && "@max-[479px]/settings:leading-[18px]"
            )}
          >
            {desc}
          </span>
        ) : null}
      </span>
      {control}
    </>
  )
  const spacing = ROW_GAP[gap ?? (leading ? "tile" : "text")]
  return (
    <div
      data-slot="settings-row"
      data-row={id}
      role="group"
      aria-labelledby={labelId}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? messageId : undefined}
    >
      {onClick ? (
        <Button
          data-slot="settings-row-body"
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={onClick}
          className={cn(
            "h-auto min-h-11 w-full flex-wrap justify-between rounded-none text-left font-normal whitespace-normal hover:bg-muted md:min-h-0",
            stack &&
              "@max-[479px]/settings:flex-col @max-[479px]/settings:items-start @max-[479px]/settings:gap-3",
            spacing,
            ROW_INSET[inset]
          )}
        >
          {body}
        </Button>
      ) : (
        <div
          data-slot="settings-row-body"
          className={cn(
            "flex w-full min-w-0 flex-wrap items-center justify-between",
            stack &&
              "@max-[479px]/settings:flex-col @max-[479px]/settings:items-start @max-[479px]/settings:gap-3",
            spacing,
            ROW_INSET[inset]
          )}
        >
          {body}
        </div>
      )}
      {error ? (
        <p
          id={messageId}
          role="alert"
          className="px-4 pb-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function SettingsUsageLink({ desc }: { desc: string }) {
  const navigate = useNavigate()
  const href = settingsSectionHref("usage")
  return (
    <a
      data-slot="settings-usage-link"
      aria-label={`Usage, ${desc}`}
      href={href}
      onClick={(event) => {
        event.preventDefault()
        void navigate({ href })
      }}
      className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card px-5 py-3.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-ui font-medium">Usage</span>
        <span className="text-xs text-muted-foreground">{desc}</span>
      </span>
      <ChevronRight className="size-3.5 text-muted-foreground" />
    </a>
  )
}

export function SettingsSkeletons() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  )
}

export function SettingsLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p>{LOAD_ERROR}</p>
      <Button size="touch" type="button" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
