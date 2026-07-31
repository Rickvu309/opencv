"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  CalendarCheck,
  Compass,
  FileText,
  GraduationCap,
  History,
  Home,
  Target,
  User,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { WeeklyReviewDialog } from "@/components/shell/weekly-review-dialog";
import { DemoTourDialog } from "@/components/shell/demo-tour-dialog";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: typeof Home;
}

const primaryNav: NavItem[] = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Opportunities", href: "/opportunities", icon: Briefcase },
];

const careerMemoryNav: NavItem[] = [
  { label: "Profile", href: "/profile", icon: User },
  { label: "CV Versions", href: "/cvs", icon: FileText },
  { label: "Track Record", href: "/track-record", icon: History },
];

const directionNav: NavItem[] = [
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Skills & Learning", href: "/skills", icon: GraduationCap },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}

function NavGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 pt-4 pb-1 text-[11px] font-semibold tracking-wide text-sidebar-foreground/45">
      {children}
    </p>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { state } = useStore();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="flex size-6 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
          OP
        </span>
        <span className="text-sm font-semibold">OpenPath</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
        {primaryNav.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}

        <NavGroupLabel>Career Memory</NavGroupLabel>
        {careerMemoryNav.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}

        <NavGroupLabel>Direction</NavGroupLabel>
        {directionNav.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>

      <Separator className="bg-sidebar-border" />

      <div className="flex flex-col gap-1 px-3 py-3">
        <WeeklyReviewDialog>
          <Button variant="ghost" size="sm" className="justify-start gap-2.5 px-2.5 text-sidebar-foreground/80 hover:bg-sidebar-accent/60">
            <CalendarCheck className="size-4" />
            Weekly Review
          </Button>
        </WeeklyReviewDialog>
        <DemoTourDialog>
          <Button variant="ghost" size="sm" className="justify-start gap-2.5 px-2.5 text-sidebar-foreground/80 hover:bg-sidebar-accent/60">
            <Compass className="size-4" />
            Demo Tour
          </Button>
        </DemoTourDialog>
      </div>

      <Separator className="bg-sidebar-border" />

      <div className="flex items-center gap-2.5 px-4 py-3">
        <Avatar size="sm">
          <AvatarFallback>MT</AvatarFallback>
        </Avatar>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-medium">{state.profile.name}</span>
          <span className="text-xs text-sidebar-foreground/55">{state.profile.headline}</span>
        </div>
      </div>
    </aside>
  );
}
