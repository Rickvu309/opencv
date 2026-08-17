"use client";

import * as React from "react";
import { Link, usePathname } from "@/lib/nav";
import { Maximize2, Minus, PenLine, X } from "lucide-react";

import { CoachBox } from "@/components/brand/coach-box";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { chatTitle } from "@/lib/coach/messages";
import { useT } from "@/lib/i18n/use-t";
import { Composer } from "./composer";
import { NewChatButton } from "./history";
import { iconSwapIn, iconSwapItem, iconSwapOut } from "./motion";
import { CoachSessionEnded } from "./session-ended";
import { useCoach } from "./provider";
import { CoachGreeting, CoachMessages } from "./thread-view";

const dockLabelClass =
  "inline-block transition-[opacity,scale,filter] duration-[var(--duration-state)] ease-snap motion-reduce:scale-100 motion-reduce:blur-none motion-reduce:transition-[opacity] motion-reduce:duration-[var(--duration-press)]";

function panelChunkClass(open: boolean, delay: boolean) {
  return cn(
    "transition-[opacity,translate] duration-[var(--duration-state)] ease-enter",
    "motion-reduce:translate-y-0 motion-reduce:delay-0 motion-reduce:transition-[opacity] motion-reduce:duration-[var(--duration-press)]",
    open
      ? cn("translate-y-0 opacity-100", delay && "delay-100")
      : "translate-y-1 opacity-0 delay-0",
  );
}

/**
 * The coach strip sits in the gutter below the content frame, like Linear's
 * agent bar: last chat title (dismissible), a Coach button opening the floating
 * panel, and history. On every page; hidden only on /coach on mobile, where it
 * would cover the composer.
 */
export function CoachDock() {
  const pathname = usePathname();
  const { messages } = useCoach();
  const { t, m } = useT();
  const [open, setOpen] = React.useState(false);
  const [showLast, setShowLast] = React.useState(true);
  const chipRef = React.useRef<HTMLButtonElement>(null);
  const onCoach = pathname.startsWith("/coach");

  // What the user actually said, not a fixed sample title from a person who
  // never used this browser. Nothing to show until there is a real turn.
  // `findLast`, not `find`: the chip is the way back into the conversation, and
  // matching forwards pinned it to the opening question for the thread's life.
  const lastAsked = messages.findLast((m) => m.role === "user")?.content.trim();

  // Closing returns focus to the Coach chip so keyboard users do not free-fall.
  const close = React.useCallback(() => {
    setOpen(false);
    chipRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <CoachPanel open={open} onClose={close} />

      <div
        className={cn(
          // Below md the strip is a real row at the foot of the frame, so the
          // scroll area above it ends where the strip begins and no screen has
          // to invent its own bottom padding to avoid being covered. From md
          // the frame gains a bottom gutter (the signed-in shell) and the strip floats
          // into it, which is the Linear-style look this started as.
          "z-30 min-w-0 items-center justify-end gap-0.5",
          "md:fixed md:right-4 md:bottom-2.5",
          onCoach ? "hidden md:flex" : "flex",
        )}
      >
        {showLast && lastAsked && (
          <span className="hidden max-w-60 items-center rounded-md bg-muted/70 pr-0.5 sm:flex">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="min-w-0 truncate rounded-md py-1 pr-1 pl-2 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
            >
              {lastAsked}
            </button>
            <button
              type="button"
              onClick={() => setShowLast(false)}
              aria-label={t(m.coach.hideRecent)}
              className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
            >
              <X className="size-3" />
            </button>
          </span>
        )}
        <button
          ref={chipRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px md:bg-transparent"
        >
          <span className="relative size-3.5 shrink-0">
            <CoachBox
              size="sm"
              filled={open}
              className={cn(iconSwapItem, open ? iconSwapOut : iconSwapIn)}
            />
            <X
              aria-hidden
              className={cn(iconSwapItem, open ? iconSwapIn : iconSwapOut)}
            />
          </span>
          <span className="relative">
            <span
              aria-hidden={open}
              className={cn(dockLabelClass, open ? iconSwapOut : iconSwapIn)}
            >
              {t(m.nav.coach)}
            </span>
            <span
              aria-hidden={!open}
              className={cn(
                "absolute inset-0 flex items-center",
                dockLabelClass,
                open ? iconSwapIn : iconSwapOut,
              )}
            >
              {t(m.common.close)}
            </span>
          </span>
        </button>
        <NewChatButton
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t(m.coach.startNewChat)}
              className="text-muted-foreground"
            >
              <PenLine />
            </Button>
          }
        />
      </div>
    </>
  );
}

/**
 * Floating chat panel, bottom right. Stays mounted so minimising never loses
 * the conversation, and so open/close can reverse on the same origin path.
 * `hidden` would snap the exit (`display: none` cannot transition).
 */
function CoachPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  // The shared conversation, not a private one: see components/coach/provider.
  const thread = useCoach();
  const { t, m } = useT();
  const panelRef = React.useRef<HTMLElement>(null);
  const isEmpty = thread.messages.length === 0 && !thread.isTyping;

  // Opening the panel should be immediately typable, focus the composer.
  React.useEffect(() => {
    if (open) panelRef.current?.querySelector("textarea")?.focus();
  }, [open]);

  return (
    <section
      ref={panelRef}
      role="dialog"
      aria-label={t(m.nav.coach)}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "fixed right-4 bottom-12 z-30 flex w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl bg-card shadow-lg ring-1 ring-border",
        "h-[min(32rem,calc(100svh-7rem))]",
        // Chip is `right-4 bottom-2.5`; this surface sits just above it.
        "origin-bottom-right",
        // 0.93 + 8% of the panel's own height, not a 3% fade: first frames
        // sit on the chip. Transitions so a second click reverses mid-flight.
        "transition-[opacity,scale,translate]",
        "motion-reduce:scale-100 motion-reduce:translate-y-0 motion-reduce:transition-[opacity] motion-reduce:duration-[var(--duration-press)]",
        open
          ? "translate-y-0 scale-100 opacity-100 duration-[var(--duration-surface)] ease-enter"
          : "pointer-events-none translate-y-[8%] scale-[0.93] opacity-0 duration-[var(--duration-state)] ease-exit",
      )}
    >
      <header
        className={cn(
          "flex shrink-0 items-center gap-0.5 border-b py-2 pr-2 pl-4",
          panelChunkClass(open, false),
        )}
      >
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
          {t(chatTitle(thread.messages))}
        </h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label={t(m.coach.minimise)}
              className="text-muted-foreground"
            >
              <Minus />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t(m.coach.minimise)}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className="text-muted-foreground"
            >
              <Link href="/coach" aria-label={t(m.coach.openFullScreen)}>
                <Maximize2 />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t(m.coach.openFullScreen)}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label={t(m.common.close)}
              className="text-muted-foreground"
            >
              <X />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t(m.common.close)}</TooltipContent>
        </Tooltip>
      </header>

      {thread.access === "locked" ? (
        // Same door as /coach, so signing in from either surface brings both
        // back: there is one session now, not one per surface.
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto",
            panelChunkClass(open, true),
          )}
        >
          <CoachSessionEnded compact />
        </div>
      ) : (
        <>
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto px-4 py-4",
              panelChunkClass(open, true),
            )}
          >
            {isEmpty ? (
              // The same welcome `/coach` shows, laid out for a 24rem panel.
              // Without it the panel opened on a blank rectangle.
              <div className="flex h-full flex-col justify-center">
                <CoachGreeting compact />
              </div>
            ) : (
              <CoachMessages thread={thread} compact visible={open} />
            )}
          </div>

          <div
            className={cn(
              "shrink-0 border-t p-2",
              panelChunkClass(open, false),
            )}
          >
            <Composer thread={thread} compact />
          </div>
        </>
      )}
    </section>
  );
}
