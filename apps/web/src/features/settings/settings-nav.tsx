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
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { NavItem } from "@workspace/ui/components/nav-item"
import { cn } from "@workspace/ui/lib/utils"

import { fetchProfile, profileKey } from "@/lib/account-api.ts"
import { startPagePath } from "@/lib/product-paths.ts"
import { resolveProfileImageSrc } from "@/lib/requests.ts"

import {
  SETTINGS_SECTIONS,
  settingsSectionHref,
  settingsViewFromPath,
  type SettingsSectionId,
} from "./sections.ts"
import { useShellProfile } from "@/lib/use-shell-profile.ts"
import { personInitials } from "./person-initials.ts"

const SETTINGS_NAV_ITEM =
  "h-11 rounded-sm text-[13px] font-normal hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-foreground md:h-7"

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
  const identity = useShellProfile()
  const photoSrc = resolveProfileImageSrc(identity.image)
  return (
    <aside
      data-slot="settings-nav"
      className="flex w-61 shrink-0 flex-col gap-px bg-sidebar px-2.5 pt-2.5 pb-3 text-sidebar-foreground"
      aria-label="Settings"
    >
      <RouterNavItem
        href={startPagePath(profile.data?.startPage)}
        className="font-medium"
      >
        <ArrowLeft aria-hidden />
        Back to app
      </RouterNavItem>
      <span aria-hidden className="h-3.5 shrink-0" />
      <p
        data-slot="settings-nav-heading"
        className="flex h-6 items-center px-2 text-xs font-medium text-muted-foreground"
      >
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
      {identity.email || identity.name ? (
        <div
          data-slot="settings-nav-footer"
          className="mt-auto flex h-8 shrink-0 items-center gap-2 px-2"
        >
          <Avatar size="sm" className="size-5">
            {photoSrc ? <AvatarImage alt="" src={photoSrc} /> : null}
            <AvatarFallback className="bg-sidebar-accent text-[10px] font-semibold">
              {personInitials(identity.name, identity.email)}
            </AvatarFallback>
          </Avatar>
          <span
            data-slot="account-name"
            title={identity.email || identity.name}
            className="min-w-0 flex-1 truncate text-[13px] font-medium"
          >
            {identity.name}
          </span>
        </div>
      ) : null}
    </aside>
  )
}

function RouterNavItem({
  href,
  current,
  className,
  children,
}: {
  href: string
  current?: boolean
  className?: string
  children: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <NavItem
      tone="muted"
      className={cn(SETTINGS_NAV_ITEM, className)}
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
