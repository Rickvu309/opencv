"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, KanbanSquare, Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { recruiterPersona } from "@/lib/data/recruiter/persona";

interface RecruiterNavItem {
  label: string;
  href: string;
  icon: typeof Briefcase;
}

const recruiterNav: RecruiterNavItem[] = [
  { label: "Pipeline", href: "/recruiter", icon: KanbanSquare },
  { label: "Roles", href: "/recruiter/roles", icon: Briefcase },
  { label: "Candidates", href: "/recruiter/candidates", icon: Users },
];

/**
 * Recruiter mode's own left navigation (RDS-988): the same shadcn Sidebar
 * primitives and shell anatomy as the candidate-side AppSidebar, but its
 * own nav, its own persona chip (Lan Pham, not Mai Tran), and a distinct
 * active-item tint (sidebar-primary instead of the candidate side's neutral
 * sidebar-accent) so the mode reads as visibly different at a glance
 * without a second palette. A compact "Recruiter" badge next to the
 * wordmark is the other visible mode cue the brief calls for.
 */
export function RecruiterSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
            OP
          </span>
          <span className="flex items-center gap-1.5 group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">OpenPath</span>
            <Badge variant="secondary" className="text-[10px]">
              Recruiter
            </Badge>
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {recruiterNav.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      className="data-active:bg-sidebar-primary/15 data-active:font-medium data-active:text-sidebar-primary"
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip={recruiterPersona.name}>
                  <Avatar size="sm">
                    <AvatarFallback>{recruiterPersona.initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="text-sm font-medium">{recruiterPersona.name}</span>
                    <span className="text-xs text-sidebar-foreground/55">{recruiterPersona.title}</span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-56">
                <DropdownMenuLabel>{recruiterPersona.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/home">Switch to candidate mode</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
