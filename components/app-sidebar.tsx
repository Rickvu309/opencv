"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  CircleQuestionMark,
  ChevronsUpDown,
  FileText,
  LayoutDashboard,
  Mail,
  MessageSquareQuote,
  Languages,
  Search,
  Send,
  Settings,
} from "lucide-react";

import { CoachCat } from "@/components/brand/coach-cat";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";
import { SignOutItem } from "@/components/auth/sign-out-item";
import { useAppState, useDispatch } from "@/lib/actions/store";
import { localeNames, locales } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/use-t";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
};

// A count of zero is not information: with the demo persona gone every rail
// item opened reading "0", which is noise on the one screen that should be
// quiet. `undefined` hides the number entirely.
const badge = (n: number) => n || undefined;

function primaryNav(): NavItem[] {
  return [
    // Clicking Coach starts a new chat, like Linear's Agent.
    // Plain /coach: this is "go to the Coach", not "throw the conversation
    // away". Starting over is an explicit choice, and it lives in the
    // history popover as "Đoạn chat mới".
    { title: messages.nav.coach, href: "/coach", icon: CoachCat },
  ];
}

function careerNav(
  cvCount: number,
  paperCount: number,
  openingCount: number,
  applicationCount: number,
): NavItem[] {
  return [
    { title: messages.nav.profile, href: "/profile", icon: LayoutDashboard },
    // Next to the profile, not under Tài liệu: a CV is a thing you build here,
    // and the count says how many versions are on the go.
    { title: messages.nav.cv, href: "/cv", icon: FileText, count: badge(cvCount) },
    // Letters and write-ups sit beside the CV because they are the same job:
    // things you write here and send somewhere. Pitch sits beside them because
    // it is the same job again, said out loud.
    {
      title: messages.nav.papers,
      href: "/papers",
      icon: Mail,
      count: badge(paperCount),
    },
    { title: messages.nav.pitch, href: "/pitch", icon: MessageSquareQuote },
    // Search and Applications sit at the end of the career group because they
    // are the last two steps: everything above is what you take into them.
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
          {item.href === "/coach" ? (
            <CoachCat size="sm" filled={active} />
          ) : (
            <item.icon />
          )}
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

export function AppSidebar() {
  const pathname = usePathname();
  // Counts and identity read from live state, not seed data, so adding a CV
  // updates the rail immediately and renaming yourself in onboarding is
  // reflected here rather than in a fixture nobody can edit.
  const { profile, resumes, papers, openings, applications } = useAppState();
  const dispatch = useDispatch();
  const { t, m, locale } = useT();
  const name = profile.identity.name.trim();
  const initials =
    name
      .split(/\s+/)
      .slice(-2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?";
  const primary = primaryNav();
  // Saved openings rather than all of them: the count is a shortlist, and
  // seeded examples are not somebody's shortlist.
  const career = careerNav(
    resumes.length,
    papers.length,
    openings.filter((opening) => opening.saved).length,
    applications.length,
  );
  const router = useRouter();
  const palette = useCommandPalette();

  return (
    <Sidebar id="app-sidebar" variant="inset" collapsible="offcanvas">
      <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />
      {/* Top row: workspace switcher + the two most-used actions. */}
      <SidebarHeader className="h-14 justify-center px-2">
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 transition-colors outline-none hover:bg-sidebar-accent/70 focus-visible:ring-3 focus-visible:ring-sidebar-ring/50 motion-reduce:transition-none">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <CoachCat size="sm" filled />
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

              <DropdownMenuSeparator />
              {/* The switcher lives beside the account rather than in a
                  settings screen there is no room for. Each language names
                  itself in its own language: offering "Vietnamese" to someone
                  who only reads Vietnamese is a menu they cannot use. */}
              <DropdownMenuLabel className="flex items-center gap-2 font-normal text-muted-foreground">
                <Languages className="size-3.5" />
                {t(m.common.language)}
              </DropdownMenuLabel>
              {locales.map((code) => (
                <DropdownMenuItem
                  key={code}
                  onSelect={() =>
                    dispatch("settings.setLanguage", { language: code })
                  }
                >
                  <span className="flex-1">{localeNames[code]}</span>
                  {locale === code && <Check className="size-3.5" />}
                </DropdownMenuItem>
              ))}

              {/* Plan and help sit in the account menu rather than the rail:
                  neither is somewhere anybody goes daily, and the rail is for
                  the work. */}
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
                  from switching language. */}
              <DropdownMenuSeparator />
              <SignOutItem />
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t(m.common.search)}
                  className="text-muted-foreground"
                  onClick={() => palette.setOpen(true)}
                >
                  <Search />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t(m.common.search)} <kbd className="ml-1 opacity-70">⌘K</kbd>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-2 py-2">
        {/* The primary group needs no label; this is where you land daily. */}
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu>
              {primary.map((item) => (
                <NavRow
                  key={item.href}
                  item={item}
                  active={pathname.startsWith(item.href.split("?")[0])}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Collapsible defaultOpen className="group/section mt-3">
          <SidebarGroup className="p-0">
            <SectionLabel>{t(m.nav.career)}</SectionLabel>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <SidebarGroupContent>
                <SidebarMenu>
                  {career.map((item) => (
                    <NavRow
                      key={item.href}
                      item={item}
                      active={pathname.startsWith(item.href)}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

    </Sidebar>
  );
}
