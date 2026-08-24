import { Link } from "@tanstack/react-router"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import {
  getDevProfile,
  profileInitials,
} from "@/features/app-shell/dev-profile.ts"
import { FOCUS_RING } from "@/features/app-shell/focus-ring.ts"
import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"

type Props = {
  collapsed?: boolean
  onNavigate?: () => void
}

export function NavProfile({ collapsed, onNavigate }: Props) {
  const profile = getDevProfile()
  const initials = profileInitials(profile.name)
  const ariaLabel = `${profile.name}, profile and settings`

  const avatar = (
    <Avatar size="sm" className="size-7 rounded-md after:rounded-md">
      {profile.avatarSrc ? (
        <AvatarImage src={profile.avatarSrc} alt="" />
      ) : null}
      <AvatarFallback className="rounded-md text-[11px] font-medium">
        {initials}
      </AvatarFallback>
    </Avatar>
  )

  const linkClassName = ({ isActive }: { isActive: boolean }) =>
    collapsed
      ? cn(
          FOCUS_RING,
          "flex h-8 w-full items-center justify-center rounded-lg transition-colors hover:bg-muted/70",
          isActive &&
            "bg-muted ring-2 ring-ring ring-offset-1 ring-offset-background"
        )
      : cn(
          FOCUS_RING,
          "flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-muted/70",
          isActive && "bg-muted"
        )

  const link = (
    <Link
      to={SURFACE_PATHS.settings}
      activeOptions={{ exact: true }}
      aria-label={ariaLabel}
      onClick={onNavigate}
      activeProps={{ className: linkClassName({ isActive: true }) }}
      inactiveProps={{ className: linkClassName({ isActive: false }) }}
    >
      {avatar}
      <span
        className={cn(
          "min-w-0 truncate text-[13px] font-medium",
          collapsed && "sr-only"
        )}
      >
        {profile.name}
      </span>
    </Link>
  )

  return (
    <div className="mt-auto shrink-0 px-1.5 pt-1 pb-0.5">
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger render={link} />
          <TooltipContent side="right">{profile.name}</TooltipContent>
        </Tooltip>
      ) : (
        link
      )}
    </div>
  )
}
