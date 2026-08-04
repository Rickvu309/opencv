"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, PanelLeft } from "lucide-react";

import { conversations } from "@/lib/data";
import { ChatHistoryPopover } from "@/components/coach/history";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const titles: Record<string, string> = {
  "/coach": "Coach",
  "/todo": "Todo",
  "/profile": "Hồ sơ",
  "/opportunities": "Hướng đi",
  "/career-map": "Career Map",
  "/plan": "Kế hoạch",
};

/**
 * The reopen button appears only while the rail is collapsed — when open, the
 * drag edge already does that job. Mobile has no edge, so it always shows.
 */
function ReopenButton() {
  const { state, toggleSidebar, isMobile } = useSidebar();
  if (!isMobile && state !== "collapsed") return null;

  const button = (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggleSidebar}
      aria-label="Mở thanh bên"
      aria-expanded={false}
      aria-controls="app-sidebar"
      className="-ml-2 shrink-0 text-muted-foreground transition-colors hover:text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-1 motion-safe:duration-200"
    >
      <PanelLeft />
    </Button>
  );

  if (isMobile) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-1.5">
        Mở thanh bên
        <kbd className="rounded border border-white/20 px-1 font-sans text-[10px] opacity-80">
          ⌘B
        </kbd>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * On the Coach page the title is a Linear-style chat switcher: current chat
 * name + chevron, opening the conversation history. ?new=1 or ?q is an
 * unnamed chat.
 */
function ChatSwitcher() {
  const params = useSearchParams();
  const isFresh = params.get("new") === "1" || !!params.get("q");
  const title = isFresh ? "Đoạn chat mới" : conversations[0].title;

  return (
    <ChatHistoryPopover
      trigger={
        <button
          type="button"
          className="flex h-7 min-w-0 items-center gap-1 rounded-md px-2 text-sm font-medium transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
        >
          <span className="truncate">{title}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      }
    />
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const onCoach = pathname.startsWith("/coach");
  const title =
    Object.entries(titles).find(([href]) => pathname.startsWith(href))?.[1] ??
    "OpenPath";

  return (
    <header className="flex h-14 shrink-0 items-center gap-1.5 border-b bg-background/85 px-4 backdrop-blur-sm">
      <ReopenButton />
      {onCoach ? (
        <>
          <h1 className="sr-only">Coach</h1>
          <React.Suspense
            fallback={<span className="text-sm font-medium">Coach</span>}
          >
            <ChatSwitcher />
          </React.Suspense>
        </>
      ) : (
        <h1 className="text-sm font-medium">{title}</h1>
      )}
    </header>
  );
}
