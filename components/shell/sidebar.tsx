"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  Compass,
  FileText,
  GraduationCap,
  History,
  Home,
  Inbox,
  Milestone,
  Rewind,
  RotateCcw,
  Route,
  Target,
  User,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { ConnectedSourcesButton } from "@/components/shell/connected-sources";
import { DemoTourDialog } from "@/components/shell/demo-tour-dialog";
import { useStore } from "@/lib/store";

interface NavItem {
  label: string;
  href: string;
  icon: typeof Home;
}

const primaryNav: NavItem[] = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Opportunities", href: "/opportunities", icon: Briefcase },
  { label: "Sources", href: "/sources", icon: Inbox },
  { label: "Rewind", href: "/rewind", icon: Rewind },
];

const careerMemoryNav: NavItem[] = [
  { label: "Profile", href: "/profile", icon: User },
  { label: "CV Versions", href: "/cvs", icon: FileText },
  { label: "Track Record", href: "/track-record", icon: History },
];

const directionNav: NavItem[] = [
  { label: "Path Planner", href: "/planner", icon: Route },
  { label: "Roadmap", href: "/roadmap", icon: Milestone },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Skills & Learning", href: "/skills", icon: GraduationCap },
];

function NavGroup({ items, isActive }: { items: NavItem[]; isActive: (href: string) => boolean }) {
  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
              <Link href={item.href}>
                <Icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

/**
 * The app shell's left navigation, rebuilt on the shadcn Sidebar primitives
 * (SidebarProvider/SidebarInset own the frame, this component only owns
 * content) so the icon rail, active states, and tooltip-on-collapse
 * behavior come from one shared system instead of hand-rolled CSS.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { state, resetOnboarding } = useStore();

  function restartSetup() {
    resetOnboarding();
    router.push("/onboarding");
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
            OP
          </span>
          <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">OpenPath</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <NavGroup items={primaryNav} isActive={isActive} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Career Memory</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavGroup items={careerMemoryNav} isActive={isActive} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Direction</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavGroup items={directionNav} isActive={isActive} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Rewind">
              <Link href="/rewind">
                <Rewind />
                <span>Rewind</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DemoTourDialog>
              <SidebarMenuButton tooltip="Demo Tour">
                <Compass />
                <span>Demo Tour</span>
              </SidebarMenuButton>
            </DemoTourDialog>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator />

        <SidebarMenu>
          <ConnectedSourcesButton />
        </SidebarMenu>

        <SidebarSeparator />

        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip={state.profile.name}>
                  <Avatar size="sm">
                    <AvatarFallback>MT</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="text-sm font-medium">{state.profile.name}</span>
                    <span className="text-xs text-sidebar-foreground/55">{state.profile.headline}</span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-56">
                <DropdownMenuLabel>{state.profile.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={restartSetup}>
                  <RotateCcw className="size-4" />
                  Restart setup
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
