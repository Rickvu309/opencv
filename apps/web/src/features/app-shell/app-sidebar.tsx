import "./design/app-sidebar.pen.css"

import { useId, type ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import {
  Briefcase,
  ChevronDown,
  FileText,
  Inbox,
  MessageCircle,
  Presentation,
  Search,
  SquareKanban,
  SquarePen,
} from "lucide-react"

import { NavProfile } from "@/features/app-shell/nav-profile.tsx"
import { searchShortcutLabel } from "@/features/app-shell/search-shortcut.ts"
import { SHELL_PRIMARY, SHELL_WORK } from "@/features/app-shell/sidebar-nav.ts"
import { shellCopy } from "@/features/app-shell/shell-copy.ts"
import {
  useInboxUnread,
  useShellFavorites,
} from "@/features/app-shell/use-shell-chats.ts"
import { useSidebarGroup } from "@/features/app-shell/use-sidebar-groups.ts"
import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { Brand } from "@workspace/ui/components/brand"
import { Button } from "@workspace/ui/components/button"
import { Kbd } from "@workspace/ui/components/kbd"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

type AppSidebarProps = {
  onNavigate?: () => void
  onSearch: () => void
  onNewChat: () => void
}

function linkClass(active: boolean) {
  return cn(
    FOCUS_RING,
    "flex h-7 items-center gap-2 rounded-md px-2 text-sm text-foreground hover:bg-sidebar-accent md:text-[13px] md:leading-[15.6px] md:font-medium",
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
  const panelId = useId()

  return (
    <div
      data-slot="sidebar-group"
      className={cn("flex flex-col gap-0.5 md:gap-px", className)}
    >
      <Button
        type="button"
        variant="ghost"
        data-slot="sidebar-group-label"
        aria-expanded={open}
        aria-controls={panelId}
        className="h-7 w-full justify-start gap-1 rounded-md px-2 text-xs font-medium hover:bg-transparent aria-expanded:bg-transparent"
        onClick={toggle}
      >
        {label}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-[9px] transition-transform duration-(--duration-micro) ease-(--ease-micro) motion-reduce:transition-none",
            !open && "-rotate-90"
          )}
        />
      </Button>
      <div
        id={panelId}
        hidden={!open}
        className="flex flex-col gap-0.5 md:gap-px"
      >
        {children}
      </div>
    </div>
  )
}

export function AppSidebar({
  onNavigate,
  onSearch,
  onNewChat,
}: AppSidebarProps) {
  const inbox = useInboxUnread()
  const favorites = useShellFavorites()
  const count = inbox.data ?? null
  const favoriteEmpty =
    favorites.jobs.length === 0 && favorites.docs.length === 0

  return (
    <div
      data-pen-surface="app-shell"
      data-slot="shell-nav"
      className="flex h-full min-h-0 w-[244px] flex-col bg-sidebar text-sidebar-foreground md:gap-px md:px-2.5 md:pt-2.5 md:pb-3"
    >
      <div
        data-slot="sidebar-top"
        className="flex h-12 shrink-0 items-center justify-between px-3 md:h-9 md:ps-1.5 md:pe-0.5"
      >
        <Brand size={14} markSize={20} gap={6} letterSpacing={0} />
        <div className="flex gap-1 md:gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={shellCopy.search}
            aria-keyshortcuts="Control+K Meta+K"
            className="md:size-7"
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
            className="md:size-7 md:rounded-full md:border md:[&_svg]:size-[15px]"
            onClick={onNewChat}
          >
            <SquarePen />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2 md:px-0 md:pb-0">
        <nav
          aria-label="Main"
          className="mt-2 flex flex-col gap-0.5 md:mt-1.5 md:gap-px"
        >
          {SHELL_PRIMARY.map((item) => {
            const Icon = navigationIcons[item.id]
            return (
              <Link
                key={item.id}
                to={item.to}
                aria-label={item.label}
                data-slot="sidebar-link"
                activeOptions={{ exact: true }}
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
          <NavGroup id="work" label={shellCopy.yourWork} className="mt-3">
            {SHELL_WORK.map((item) => {
              const Icon = navigationIcons[item.id]
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  data-slot="sidebar-link"
                  activeOptions={{ exact: true }}
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
                onClick={onNavigate}
                className={linkClass(false)}
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
                aria-label={
                  job.company ? `${job.title} ${job.company}` : job.title
                }
                title={job.company ? `${job.title}, ${job.company}` : job.title}
                onClick={onNavigate}
                className={linkClass(false)}
              >
                <Briefcase className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{job.title}</span>
              </Link>
            ))}
          </NavGroup>
        )}
      </div>
      <NavProfile onNavigate={onNavigate} />
    </div>
  )
}
