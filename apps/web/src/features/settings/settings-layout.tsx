import type { ReactNode } from "react"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import type { Profile } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { NavItem } from "@workspace/ui/components/nav-item"
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
  name,
  children,
}: {
  view: SettingsView
  startPage?: Profile["startPage"]
  name?: string
  children: ReactNode
}) {
  const desktop = useMediaQuery(DESKTOP_MEDIA_QUERY, true)
  const current: SettingsSectionId = view
  return (
    <div
      data-slot="settings-layout"
      className="flex h-dvh min-h-0 flex-col overflow-x-hidden bg-background text-foreground md:flex-row"
    >
      {desktop ? (
        <aside
          className="flex w-60 shrink-0 flex-col gap-1 px-3 py-3"
          aria-label="Settings"
        >
          <BackLink href={startPagePath(startPage)} />
          <p className="flex h-6 items-center px-2 text-sm text-muted-foreground">
            Settings
          </p>
          <nav className="flex flex-col gap-1" aria-label="Settings sections">
            {SETTINGS_SECTIONS.map((item) => (
              <SectionLink
                key={item.id}
                href={settingsSectionHref(item.id)}
                current={item.id === current}
              >
                {item.label}
              </SectionLink>
            ))}
          </nav>
          {name ? (
            <p className="mt-auto truncate px-2 pt-4 text-sm font-medium">
              {name}
            </p>
          ) : null}
        </aside>
      ) : (
        <PageHeader>
          <PageHeaderLeading>
            <PhoneBack href={startPagePath(startPage)} />
          </PageHeaderLeading>
          <SectionSelect current={current} />
        </PageHeader>
      )}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-8 md:px-10 md:py-14">
        <main className="mx-auto flex w-full max-w-[640px] flex-col">
          {children}
        </main>
      </div>
    </div>
  )
}

function BackLink({ href }: { href: string }) {
  const navigate = useNavigate()
  return (
    <NavItem
      tone="muted"
      href={href}
      onClick={(event) => {
        event.preventDefault()
        void navigate({ href })
      }}
    >
      <ArrowLeft aria-hidden />
      Back to app
    </NavItem>
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

function SectionLink({
  href,
  current,
  children,
}: {
  href: string
  current: boolean
  children: string
}) {
  const navigate = useNavigate()
  return (
    <NavItem
      tone="muted"
      href={href}
      active={current}
      onClick={(event) => {
        event.preventDefault()
        void navigate({ href })
      }}
    >
      {children}
    </NavItem>
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
        className="w-full min-w-0 touch-manipulation data-[size=default]:max-md:h-11"
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

export function SettingsTitle({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div data-slot="settings-title" className="mb-7 flex flex-col gap-1.5">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children ? (
        <p className="text-sm text-muted-foreground">{children}</p>
      ) : null}
    </div>
  )
}

export function SettingsSection({
  label,
  note,
  children,
}: {
  label: string
  note?: string
  children: ReactNode
}) {
  return (
    <section data-slot="settings-section" className="mb-7 flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">{label}</h2>
        {note ? (
          <span className="text-sm text-muted-foreground">{note}</span>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export function SettingsCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      data-slot="settings-card"
      className={cn(
        "flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card",
        className
      )}
    >
      {children}
    </div>
  )
}

export function SettingsRow({
  label,
  desc,
  control,
  onClick,
  disabled,
  error,
}: {
  label: string
  desc?: ReactNode
  control?: ReactNode
  onClick?: () => void
  disabled?: boolean
  error?: string
}) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium">{label}</span>
        {desc ? (
          <span className="text-sm break-words text-muted-foreground">
            {desc}
          </span>
        ) : null}
      </span>
      {control}
    </>
  )
  return (
    <div data-slot="settings-row">
      {onClick ? (
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={onClick}
          className="h-auto min-h-11 w-full flex-wrap justify-between gap-3 rounded-none px-4 py-3.5 text-left font-normal whitespace-normal hover:bg-muted md:min-h-0"
        >
          {body}
        </Button>
      ) : (
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          {body}
        </div>
      )}
      {error ? (
        <p role="alert" className="px-4 pb-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function StateWord({ on }: { on: boolean }) {
  return (
    <span className="shrink-0 text-sm text-muted-foreground">
      {on ? "Enabled" : "Disabled"}
    </span>
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
      <Button
        className="h-11 md:h-8"
        type="button"
        variant="outline"
        onClick={onRetry}
      >
        Try again
      </Button>
    </div>
  )
}
