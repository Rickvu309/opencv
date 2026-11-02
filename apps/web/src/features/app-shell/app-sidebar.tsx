import "./design/app-sidebar.pen.css"

import type { ReactNode } from "react"
import { Link, useLocation } from "@tanstack/react-router"
import {
  Briefcase,
  FileText,
  Inbox,
  MessageCircle,
  Presentation,
  Search,
  SquareKanban,
  SquarePen,
} from "lucide-react"

import { NavProfile } from "@/features/app-shell/nav-profile.tsx"
import { SidebarToggle } from "@/features/app-shell/sidebar-toggle.tsx"
import { searchShortcutLabel } from "@/features/app-shell/search-shortcut.ts"
import {
  currentNavPath,
  favoriteDocPath,
  favoriteJobPath,
  navActiveOptions,
  SHELL_PRIMARY,
  SHELL_WORK,
  shellNavLabel,
} from "@/features/app-shell/sidebar-nav.ts"
import { shellCopy } from "@/features/app-shell/shell-copy.ts"
import {
  useInboxUnread,
  useShellFavorites,
} from "@/features/app-shell/use-shell-chats.ts"
import { useSidebarGroup } from "@/features/app-shell/use-sidebar-groups.ts"
import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { Brand } from "@workspace/ui/components/brand"
import { Button } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import { Kbd } from "@workspace/ui/components/kbd"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

type AppSidebarProps = {
  toggle?: {
    label: string
    direction: "close" | "open"
    onClick: () => void
  }
  onMenuOpenChange?: (open: boolean) => void
  onNavigate?: () => void
  onSearch: () => void
  onNewChat: () => void
}

function linkClass(active: boolean) {
  return cn(
    FOCUS_RING,
    "flex h-11 items-center gap-2 px-2 text-sm text-foreground hover:bg-sidebar-accent md:h-7 md:text-[13px] md:leading-[15.6px] md:font-medium",
    active && "bg-sidebar-accent text-sidebar-accent-foreground"
  )
}

const navigationIcons = {
  inbox: Inbox,
  coach: MessageCircle,
  jobs: Briefcase,
  paper: FileText,
  apply: SquareKanban,
  pitch: Presentation,
}

function NavGroup({
  id,
  label,
  className,
  children,
}: {
  id: string
  label: string
  className?: string
  children: ReactNode
}) {
  const { open, toggle } = useSidebarGroup(id)

  return (
    <Collapsible
      open={open}
      onOpenChange={toggle}
      data-slot="sidebar-group"
      className={cn("flex flex-col gap-0.5 md:gap-px", className)}
    >
      <CollapsibleTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            data-slot="sidebar-group-label"
            className="h-11 w-full justify-start gap-1 border-0 px-2 text-xs font-medium hover:bg-sidebar-accent aria-expanded:bg-transparent aria-expanded:hover:bg-sidebar-accent md:h-7"
          />
        }
      >
        {label}
        <CollapsibleIndicator className="size-[9px]" />
      </CollapsibleTrigger>
      <CollapsibleContent
        keepMounted
        className="flex flex-col gap-0.5 md:gap-px"
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function AppSidebar({
  toggle,
  onMenuOpenChange,
  onNavigate,
  onSearch,
  onNewChat,
}: AppSidebarProps) {
  const inbox = useInboxUnread()
  const favorites = useShellFavorites()
  const count = inbox.data ?? null
  const favoriteEmpty =
    favorites.jobs.length === 0 && favorites.docs.length === 0
  const pathname = useLocation({ select: (location) => location.pathname })
  const current = currentNavPath(pathname, [
    ...SHELL_PRIMARY.map((item) => item.to),
    ...SHELL_WORK.map((item) => item.to),
    ...favorites.docs.map((doc) => favoriteDocPath(doc.id)),
    ...favorites.jobs.map((job) => favoriteJobPath(job.id)),
  ])

  return (
    <div
      data-pen-surface="app-shell"
      data-slot="shell-nav"
      className="flex h-full min-h-0 w-full min-w-0 flex-col bg-sidebar text-sidebar-foreground md:gap-px md:px-2.5 md:pt-2.5 md:pb-3"
    >
      <div
        data-slot="sidebar-top"
        className="flex h-12 shrink-0 items-center px-3 md:h-9 md:ps-1.5 md:pe-0.5"
      >
        <Brand size={14} markSize={20} gap={6} letterSpacing={0} />
        {toggle ? (
          <SidebarToggle
            label={toggle.label}
            direction={toggle.direction}
            onClick={toggle.onClick}
            className="ms-2 shrink-0"
          />
        ) : null}
        <div className="ml-auto flex gap-1 md:gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={shellCopy.search}
            aria-keyshortcuts="Control+K Meta+K"
            className="size-11 hover:bg-sidebar-accent aria-expanded:bg-sidebar-accent md:size-7"
            onClick={onSearch}
          >
            <Search />
            <Kbd className="sr-only">{searchShortcutLabel()}</Kbd>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={shellCopy.newChat}
            className="size-11 md:size-7 md:rounded-full md:border md:[&_svg]:size-[15px]"
            onClick={onNewChat}
          >
            <SquarePen />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2 md:px-0 md:pb-0">
        <nav
          aria-label="Main"
          className="mt-2 flex flex-col gap-0.5 md:mt-[7px] md:gap-px"
        >
          {SHELL_PRIMARY.map((item) => {
            const Icon = navigationIcons[item.id]
            return (
              <Link
                key={item.id}
                to={item.to}
                aria-label={shellNavLabel(item, count)}
                data-slot="sidebar-link"
                activeOptions={navActiveOptions(item.to, current)}
                onClick={onNavigate}
                activeProps={{ className: linkClass(true) }}
                inactiveProps={{ className: linkClass(false) }}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span>{item.label}</span>
                {item.id === "inbox" && count != null ? (
                  <span
                    aria-hidden="true"
                    data-slot="sidebar-count"
                    className="ml-auto text-xs md:text-[11px] md:font-medium"
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
            )
          })}
          <NavGroup
            id="work"
            label={shellCopy.yourWork}
            className="mt-3 md:mt-[11px]"
          >
            {SHELL_WORK.map((item) => {
              const Icon = navigationIcons[item.id]
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  data-slot="sidebar-link"
                  activeOptions={navActiveOptions(item.to, current)}
                  onClick={onNavigate}
                  activeProps={{ className: linkClass(true) }}
                  inactiveProps={{ className: linkClass(false) }}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                </Link>
              )
            })}
          </NavGroup>
        </nav>
        {favorites.pending ? (
          <Skeleton className="mx-2 mt-3 h-7" />
        ) : favoriteEmpty ? null : (
          <NavGroup id="favorites" label={shellCopy.favorites} className="mt-3">
            {favorites.docs.map((doc) => (
              <Link
                data-slot="sidebar-link"
                key={doc.id || doc.name}
                to="/paper/$docId"
                params={{ docId: doc.id }}
                activeOptions={navActiveOptions(
                  favoriteDocPath(doc.id),
                  current
                )}
                onClick={onNavigate}
                activeProps={{ className: linkClass(true) }}
                inactiveProps={{ className: linkClass(false) }}
              >
                <FileText className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{doc.name}</span>
              </Link>
            ))}
            {favorites.jobs.map((job) => (
              <Link
                data-slot="sidebar-link"
                key={job.id || job.title}
                to="/apply/$jobId"
                params={{ jobId: job.id }}
                activeOptions={navActiveOptions(
                  favoriteJobPath(job.id),
                  current
                )}
                aria-label={
                  job.company ? `${job.title} ${job.company}` : job.title
                }
                title={job.company ? `${job.title}, ${job.company}` : job.title}
                onClick={onNavigate}
                activeProps={{ className: linkClass(true) }}
                inactiveProps={{ className: linkClass(false) }}
              >
                <Briefcase className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{job.title}</span>
              </Link>
            ))}
          </NavGroup>
        )}
      </div>
      <NavProfile onNavigate={onNavigate} onMenuOpenChange={onMenuOpenChange} />
    </div>
  )
}
