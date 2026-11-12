import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import {
  ArrowLeft,
  CircleUser,
  CreditCard,
  Gauge,
  MessageCircle,
  Plug,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react"
import { NavItem } from "@workspace/ui/components/nav-item"

import { fetchProfile, profileKey } from "@/lib/account-api.ts"
import { startPagePath } from "@/lib/product-paths.ts"

import {
  SETTINGS_SECTIONS,
  settingsSectionHref,
  settingsViewFromPath,
  type SettingsSectionId,
} from "./sections.ts"

const SETTINGS_NAV_ITEM =
  "h-11 rounded-sm hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent md:h-7"

const SECTION_ICONS: Record<SettingsSectionId, LucideIcon> = {
  preferences: SlidersHorizontal,
  coach: MessageCircle,
  integrations: Plug,
  usage: Gauge,
  billing: CreditCard,
  account: CircleUser,
}

export function SettingsNav() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const current = settingsViewFromPath(pathname)
  const profile = useQuery({ queryKey: profileKey(), queryFn: fetchProfile })
  const name = profile.data?.name
  return (
    <aside
      data-slot="settings-nav"
      className="flex w-61 shrink-0 flex-col gap-px bg-sidebar px-2.5 pt-2.5 pb-3 text-sidebar-foreground"
      aria-label="Settings"
    >
      <RouterNavItem href={startPagePath(profile.data?.startPage)}>
        <ArrowLeft aria-hidden />
        Back to app
      </RouterNavItem>
      <span aria-hidden className="h-3.5 shrink-0" />
      <p className="flex h-6 items-center px-2 text-sm text-muted-foreground">
        Settings
      </p>
      <nav className="flex flex-col gap-px" aria-label="Settings sections">
        {SETTINGS_SECTIONS.map((item) => {
          const Icon = SECTION_ICONS[item.id]
          return (
            <RouterNavItem
              key={item.id}
              href={settingsSectionHref(item.id)}
              current={item.id === current}
            >
              <Icon aria-hidden />
              {item.label}
            </RouterNavItem>
          )
        })}
      </nav>
      {name ? (
        <p className="mt-auto truncate px-2 pt-4 text-sm font-medium">{name}</p>
      ) : null}
    </aside>
  )
}

function RouterNavItem({
  href,
  current,
  children,
}: {
  href: string
  current?: boolean
  children: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <NavItem
      tone="muted"
      className={SETTINGS_NAV_ITEM}
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
