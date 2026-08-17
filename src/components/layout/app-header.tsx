"use client";

import { ChevronDown, PanelLeft } from "lucide-react";

import { usePathname } from "@/lib/nav";
import { chatTitle } from "@/lib/coach/messages";
import { useT } from "@/lib/i18n/use-t";
import { useCoach } from "@/components/coach/provider";
import { ConversationMenu } from "@/components/coach/history";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Route prefix to the nav entry that names it, so the header and the rail
 *  can never call the same screen two different things. */
const titleKeys = [
  ["/coach", "coach"],
  ["/profile", "profile"],
  ["/paper", "paper"],
  ["/pitch", "pitch"],
  ["/search", "search"],
  ["/applications", "applications"],
  ["/settings", "billing"],
  ["/help", "support"],
] as const;

/**
 * The reopen button appears only while the rail is collapsed, when open, the
 * drag edge already does that job. Mobile has no edge, so it always shows.
 */
function ReopenButton() {
  const { state, toggleSidebar, isMobile } = useSidebar();
  const { t, m } = useT();
  if (!isMobile && state !== "collapsed") return null;

  const button = (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggleSidebar}
      aria-label={t(m.common.openSidebar)}
      aria-expanded={false}
      aria-controls="app-sidebar"
      className="-ml-2 shrink-0 text-muted-foreground hover:text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-1 motion-safe:duration-[var(--duration-state)] motion-safe:ease-enter"
    >
      <PanelLeft />
    </Button>
  );

  if (isMobile) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-1.5">
        {t(m.common.openSidebar)}
        <kbd className="rounded border border-white/20 px-1 font-sans text-[10px] opacity-80">
          ⌘B
        </kbd>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * On the Coach page, which conversation you are in — and the way into the
 * others.
 *
 * This was a button that started a new chat, because there was one thread and
 * a switcher into a list of one would have been a lie. It is a real switcher
 * now: the title is what this thread's opening question was, and the menu holds
 * the rest.
 */
function ChatSwitcher() {
  const thread = useCoach();
  const { t, m } = useT();
  const current = thread.conversations.find(
    (c) => c.id === thread.conversationId,
  );
  // The stored title is the first question, which does not exist until one has
  // been asked. Until then this says what the thread is, not what it is called.
  const title = current?.title || t(chatTitle(thread.messages));

  return (
    <ConversationMenu
      trigger={
        <button
          type="button"
          aria-label={t(m.coach.switchChat)}
          className="flex h-7 min-w-0 items-center gap-1 rounded-md px-2 text-sm font-medium outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
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
  const { t, m } = useT();
  const onCoach = pathname.startsWith("/coach");
  const key = titleKeys.find(([href]) => pathname.startsWith(href))?.[1];
  const title = key ? t(m.nav[key]) : "OpenPath";

  return (
    <header className="flex h-14 shrink-0 items-center gap-1.5 border-b bg-background px-4">
      <ReopenButton />
      {onCoach ? (
        <>
          <h1 className="sr-only">{t(m.nav.coach)}</h1>
          <ChatSwitcher />
        </>
      ) : (
        <p className="text-sm font-medium">{title}</p>
      )}
    </header>
  );
}
