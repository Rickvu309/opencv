"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  CircleQuestionMark,
  ChevronsUpDown,
  FileText,
  LayoutDashboard,
  MessageSquareQuote,
  Route,
  Search,
  Send,
  Settings,
} from "lucide-react";

import { CoachBox } from "@/components/brand/coach-box";
import { SignOutItem } from "@/components/auth/sign-out-item";
import { ConversationRail } from "@/components/coach/history";
import { useAppState } from "@/lib/actions/store";
import { messages } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/use-t";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { Msg } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

/** The active item lifts off the grey rail as a white card. */
const activeItem =
  "data-active:bg-card data-active:shadow-xs data-active:ring-1 data-active:ring-border";

// 28px is Linear's density and right for a pointer, but the same rail is the
// mobile nav, where it becomes a 28px touch target. Taller on touch, unchanged
// on desktop.
const rowSize = "h-10 text-sm md:h-7 md:text-[13px]";

type NavItem = {
  title: Msg;
  href: string;
  icon: React.ElementType;
  count?: number;
  aliases?: string[];
};

// A count of zero is not information: with the demo persona gone every rail
// item opened reading "0", which is noise on the one screen that should be
// quiet. `undefined` hides the number entirely.
const badge = (n: number) => n || undefined;

function prepareNav(paperCount: number): NavItem[] {
  return [
    // My Paper: CVs and letters in one library. Pitch stays how you present.
    {
      title: messages.nav.cv,
      href: "/paper",
      icon: FileText,
      count: badge(paperCount),
      aliases: ["/cv", "/papers"],
    },
    { title: messages.nav.pitch, href: "/pitch", icon: MessageSquareQuote },
  ];
}

function landNav(openingCount: number, applicationCount: number): NavItem[] {
  return [
    // Split at "interested": search until you save one, then applications.
    {
      title: messages.nav.search,
      href: "/search",
      icon: Search,
      count: badge(openingCount),
    },
    {
      title: messages.nav.applications,
      href: "/applications",
      icon: Send,
      count: badge(applicationCount),
    },
  ];
}

/**
 * Collapsible group label. The chevron always shows, right after the text,
 * Linear signals "collapsible" with that arrow even when closed, so it must not
 * hide until hover.
 */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <CollapsibleTrigger className="flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground transition active:translate-y-px outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/50 motion-reduce:transition-none [&[data-state=open]>svg]:rotate-90">
      <span className="truncate">{children}</span>
      <ChevronRight className="size-3 shrink-0 opacity-70 transition-transform duration-[var(--duration-state)] ease-snap motion-reduce:transition-none" />
    </CollapsibleTrigger>
  );
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const { t } = useT();
  const title = t(item.title);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={title}
        className={cn(rowSize, activeItem)}
      >
        <Link href={item.href}>
          <item.icon />
          <span>{title}</span>
          {item.count !== undefined && (
            <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
              {item.count}
            </span>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavSection({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <Collapsible defaultOpen className="group/section mt-3 shrink-0">
      <SidebarGroup className="p-0">
        <SectionLabel>{label}</SectionLabel>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <NavRow
                  key={item.href}
                  item={item}
                  active={
                    pathname.startsWith(item.href) ||
                    (item.aliases?.some((alias) => pathname.startsWith(alias)) ??
                      false)
                  }
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  // Counts and identity read from live state, not seed data, so adding a CV
  // updates the rail immediately and renaming yourself in onboarding is
  // reflected here rather than in a fixture nobody can edit.
  const { profile, resumes, papers, openings, applications } = useAppState();
  const { t, m } = useT();
  const name = profile.identity.name.trim();
  const initials =
    name
      .split(/\s+/)
      .slice(-2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?";
  const prepare = prepareNav(resumes.length + papers.length);
  // Saved openings rather than all of them: the count is a shortlist, and
  // seeded examples are not somebody's shortlist.
  const land = landNav(
    openings.filter((opening) => opening.saved).length,
    applications.length,
  );
  const router = useRouter();

  return (
    <Sidebar id="app-sidebar" variant="inset" collapsible="offcanvas">
      {/* Top row: workspace switcher only. New chat lives in the header switcher. */}
      <SidebarHeader className="h-14 justify-center px-2">
        <div className="flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1 transition-colors outline-none hover:bg-sidebar-accent/70 focus-visible:ring-3 focus-visible:ring-sidebar-ring/50 motion-reduce:transition-none">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Route className="size-3.5" />
              </span>
              <span className="truncate text-[13px] font-semibold tracking-tight">
                OpenPath
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel className="flex items-center gap-2.5 font-normal">
                <Avatar className="size-8 rounded-md">
                  <AvatarFallback className="rounded-md text-[11px] font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="grid min-w-0 leading-tight">
                  <span className="truncate text-sm font-medium">
                    {name || t(m.nav.yourProfile)}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {profile.identity.targetRole || t(m.nav.noGoalYet)}
                  </span>
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push("/profile")}>
                <LayoutDashboard />
                {t(m.nav.yourProfile)}
              </DropdownMenuItem>

              {/* Plan and help sit in the account menu rather than the rail:
                  neither is somewhere anybody goes daily, and the rail is for
                  the work. Language lives on the ? button, one tap from
                  every screen. */}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="size-3.5" />
                  <span className="flex-1">{t(m.nav.billing)}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/help">
                  <CircleQuestionMark className="size-3.5" />
                  <span className="flex-1">{t(m.nav.support)}</span>
                </Link>
              </DropdownMenuItem>

              {/* Last, and behind a separator: it is the one item here that
                  ends the session, and it should not sit a mis-click away
                  from the rest of the account. */}
              <DropdownMenuSeparator />
              <SignOutItem />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-2 py-2">
        {/* The primary group needs no label; this is where you land daily. */}
        <SidebarGroup className="shrink-0 p-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <NavRow
                item={{
                  title: messages.nav.coach,
                  href: "/coach",
                  icon: CoachBox,
                }}
                active={pathname.startsWith("/coach")}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <NavSection
          label={t(m.nav.prepare)}
          items={prepare}
          pathname={pathname}
        />
        <NavSection label={t(m.nav.land)} items={land} pathname={pathname} />
        <Collapsible defaultOpen className="group/section mt-3 shrink-0">
          <SidebarGroup className="p-0">
            <SectionLabel>{t(m.nav.chats)}</SectionLabel>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <ConversationRail />
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>
    </Sidebar>
  );
}
