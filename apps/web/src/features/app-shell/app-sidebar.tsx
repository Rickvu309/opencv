import type { ComponentType, ReactElement } from "react"
import { Link } from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import {
  Briefcase,
  FileText,
  Globe,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react"

import { OpenCvLogo } from "@/features/app-shell/app-logo.tsx"
import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { NavProfile } from "@/features/app-shell/nav-profile.tsx"
import { SidebarHistory } from "@/features/app-shell/sidebar-history.tsx"
import {
  SEARCH_PATH,
  SURFACE_PATHS,
  type SurfaceId,
} from "@/features/app-shell/surfaces.ts"
import { useThreadList } from "@/features/home/use-thread-list.ts"

type RouteNavItem = {
  kind: "route"
  id: Exclude<SurfaceId, "settings"> | "search"
  label: string
  icon: ComponentType<{ className?: string }>
  to:
    | (typeof SURFACE_PATHS)[Exclude<SurfaceId, "settings">]
    | typeof SEARCH_PATH
  badge?: boolean
}

const PRIMARY_NAV: RouteNavItem[] = [
  {
    kind: "route",
    id: "home",
    label: "Home",
    icon: Home,
    to: SURFACE_PATHS.home,
  },
  {
    kind: "route",
    id: "search",
    label: "Search",
    icon: Search,
    to: SEARCH_PATH,
  },
  {
    kind: "route",
    id: "paper",
    label: "Paper",
    icon: FileText,
    to: SURFACE_PATHS.paper,
  },
  {
    kind: "route",
    id: "apply",
    label: "Apply",
    icon: Briefcase,
    to: SURFACE_PATHS.apply,
    badge: true,
  },
  {
    kind: "route",
    id: "pitch",
    label: "Pitch",
    icon: Globe,
    to: SURFACE_PATHS.pitch,
  },
]

function navItemClassName(active: boolean, collapsed: boolean) {
  return cn(
    FOCUS_RING,
    "relative flex h-8 w-full items-center rounded-lg border border-transparent text-sm transition-colors",
    collapsed ? "justify-center px-0" : "justify-start gap-2 px-2 text-left",
    active
      ? "bg-muted font-medium text-foreground"
      : "text-foreground/80 hover:bg-muted/70"
  )
}

function ActivityBadge({ collapsed }: { collapsed: boolean }) {
  return (
    <Badge
      aria-hidden
      className={cn(
        "size-1.5 border-0 bg-info p-0",
        collapsed ? "absolute top-1.5 right-1.5" : "ml-auto"
      )}
    />
  )
}

function NavLabel({
  collapsed,
  children,
}: {
  collapsed: boolean
  children: string
}) {
  return (
    <span
      className={cn(
        "truncate transition-opacity duration-200",
        collapsed ? "sr-only" : "opacity-100"
      )}
    >
      {children}
    </span>
  )
}

function CollapsedTip({
  label,
  children,
}: {
  label: string
  children: ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

function RouteNavLink({
  item,
  collapsed,
  onClick,
}: {
  item: RouteNavItem
  collapsed: boolean
  onClick?: () => void
}) {
  const Icon = item.icon
  const inner = (
    <>
      <Icon className="size-4 shrink-0 text-foreground/70" />
      <NavLabel collapsed={collapsed}>{item.label}</NavLabel>
      {item.badge ? <ActivityBadge collapsed={collapsed} /> : null}
    </>
  )

  const link = (
    <Link
      to={item.to}
      onClick={onClick}
      activeOptions={{ exact: true }}
      activeProps={{
        className: navItemClassName(true, collapsed),
        "aria-current": "page",
      }}
      inactiveProps={{ className: navItemClassName(false, collapsed) }}
    >
      {inner}
    </Link>
  )

  if (!collapsed) {
    return link
  }

  return <CollapsedTip label={item.label}>{link}</CollapsedTip>
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate?: () => void
}

export function AppSidebar({
  open,
  onOpenChange,
  onNavigate,
}: Props) {
  const { newThread } = useThreadList()
  const collapsed = !open

  return (
    <TooltipProvider>
      <aside
        aria-label="App"
        data-expanded={open ? "true" : "false"}
        className={cn(
          "flex h-full shrink-0 flex-col overflow-hidden border-r border-border/60 bg-background py-2 transition-[width] duration-200 ease-in-out",
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40",
          open ? "w-[15rem]" : "w-14"
        )}
      >
        <div
          className={cn(
            "mb-1 flex h-8 shrink-0 items-center",
            open ? "justify-between px-2" : "justify-center px-1"
          )}
        >
          {open ? (
            <>
              <OpenCvLogo size="sm" />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Collapse sidebar"
                aria-expanded={true}
                aria-controls="app-sidebar-nav"
                onClick={() => onOpenChange(false)}
              >
                <PanelLeftClose />
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Expand sidebar"
              aria-expanded={false}
              aria-controls="app-sidebar-nav"
              onClick={() => onOpenChange(true)}
            >
              <PanelLeftOpen />
            </Button>
          )}
        </div>

        <nav
          id="app-sidebar-nav"
          aria-label="Surfaces"
          className="flex flex-col gap-0.5 px-1.5"
        >
          {PRIMARY_NAV.map((item) => (
            <RouteNavLink
              key={item.id}
              item={item}
              collapsed={collapsed}
              onClick={() => {
                if (item.id === "home") newThread()
                onNavigate?.()
              }}
            />
          ))}
        </nav>

        <SidebarHistory collapsed={collapsed} onNavigate={onNavigate} />

        <NavProfile collapsed={collapsed} onNavigate={onNavigate} />
      </aside>
    </TooltipProvider>
  )
}
