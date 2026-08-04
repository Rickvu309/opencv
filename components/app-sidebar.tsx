"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronsUpDown,
  Compass,
  CheckSquare,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Route,
  Search,
  Settings,
} from "lucide-react";

import { actionPlan, conversations, opportunities, user } from "@/lib/data";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const openTasks = actionPlan.reduce(
  (n, p) => n + p.items.filter((i) => !i.done).length,
  0,
);

/** The active item lifts off the grey rail as a white card. */
const activeItem =
  "data-active:bg-card data-active:shadow-xs data-active:ring-1 data-active:ring-border";

const rowSize = "h-7 text-[13px]";

type NavItem = {
  title: string;
  href: string;
  icon: React.ElementType;
  count?: number;
};

const primary: NavItem[] = [
  // Clicking Coach starts a new chat, like Linear's Agent.
  { title: "Coach", href: "/coach?new=1", icon: Megaphone },
  { title: "Todo", href: "/todo", icon: CheckSquare, count: openTasks },
];

const career: NavItem[] = [
  { title: "Hồ sơ", href: "/profile", icon: LayoutDashboard },
  {
    title: "Hướng đi",
    href: "/opportunities",
    icon: Compass,
    count: opportunities.length,
  },
  { title: "Career Map", href: "/career-map", icon: Route },
  { title: "Kế hoạch", href: "/plan", icon: ListChecks, count: openTasks },
];

/**
 * Collapsible group label. The chevron always shows, right after the text —
 * Linear signals "collapsible" with that arrow even when closed, so it must not
 * hide until hover.
 */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <CollapsibleTrigger className="flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/50 motion-reduce:transition-none [&[data-state=open]>svg]:rotate-90">
      <span className="truncate">{children}</span>
      <ChevronRight className="size-3 shrink-0 opacity-70 transition-transform duration-200 motion-reduce:transition-none" />
    </CollapsibleTrigger>
  );
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.title}
        className={cn(rowSize, activeItem)}
      >
        <Link href={item.href}>
          <item.icon />
          <span>{item.title}</span>
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
  const router = useRouter();
  const onPlan = pathname.startsWith("/plan");

  return (
    <Sidebar id="app-sidebar" variant="inset" collapsible="offcanvas">
      {/* Top row: workspace switcher + the two most-used actions. */}
      <SidebarHeader className="h-14 justify-center px-2">
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 transition-colors outline-none hover:bg-sidebar-accent/70 focus-visible:ring-3 focus-visible:ring-sidebar-ring/50 motion-reduce:transition-none">
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
                    {user.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="grid min-w-0 leading-tight">
                  <span className="truncate text-sm font-medium">
                    {user.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push("/profile")}>
                <LayoutDashboard />
                Hồ sơ của bạn
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/onboarding")}>
                <Settings />
                Cập nhật thông tin
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Tìm kiếm"
                  className="text-muted-foreground"
                >
                  <Search />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Tìm kiếm <kbd className="ml-1 opacity-70">⌘K</kbd>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-2 py-2">
        {/* The primary group needs no label — this is where you land daily. */}
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
            <SectionLabel>Sự nghiệp</SectionLabel>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <SidebarGroupContent>
                <SidebarMenu>
                  {career.map((item) => (
                    <React.Fragment key={item.href}>
                      <NavRow
                        item={item}
                        active={pathname.startsWith(item.href)}
                      />
                      {/* Plan phases nest below, shown only while on that page. */}
                      {item.href === "/plan" && onPlan && (
                        <SidebarMenuSub>
                          {actionPlan.map((phase) => {
                            const done = phase.items.filter(
                              (i) => i.done,
                            ).length;
                            return (
                              <SidebarMenuSubItem key={phase.id}>
                                <SidebarMenuSubButton
                                  asChild
                                  size="sm"
                                  className="text-muted-foreground"
                                >
                                  <Link href="/plan">
                                    <span className="truncate">
                                      {phase.label.replace(/^Giai đoạn /, "GĐ ")}
                                    </span>
                                    <span className="ml-auto text-[11px] tabular-nums">
                                      {done}/{phase.items.length}
                                    </span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      )}
                    </React.Fragment>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Collapsible
          defaultOpen
          className="group/section mt-3 min-h-0"
        >
          <SidebarGroup className="p-0">
            <SectionLabel>Gần đây</SectionLabel>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <SidebarGroupContent className="max-h-52 overflow-y-auto">
                <SidebarMenu>
                  {conversations.map((c) => (
                    <SidebarMenuItem key={c.id}>
                      <SidebarMenuButton
                        asChild
                        tooltip={c.title}
                        className={cn(rowSize, "text-muted-foreground")}
                      >
                        <Link href="/coach">
                          <span className="truncate">{c.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
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
