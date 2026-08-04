"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Maximize2, Megaphone, Minus, X } from "lucide-react";

import { chatSeed, conversations } from "@/lib/data";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";
import { ChatHistoryPopover } from "./history";
import { CoachMessages, useCoachThread } from "./thread";

const lastChat = conversations[0];

/**
 * The coach strip sits in the gutter below the content frame, like Linear's
 * agent bar: last chat title (dismissible), a Coach button opening the floating
 * panel, and history. On every page; hidden only on /coach on mobile, where it
 * would cover the composer.
 */
export function CoachDock() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [showLast, setShowLast] = React.useState(true);
  const chipRef = React.useRef<HTMLButtonElement>(null);
  const onCoach = pathname.startsWith("/coach");

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
          "fixed right-4 bottom-2.5 z-30 items-center gap-0.5",
          onCoach ? "hidden md:flex" : "flex",
        )}
      >
        {showLast && (
          <span className="hidden max-w-60 items-center rounded-md bg-muted/70 pr-0.5 sm:flex">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="min-w-0 truncate rounded-md py-1 pr-1 pl-2 text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
            >
              {lastChat.title}
            </button>
            <button
              type="button"
              onClick={() => setShowLast(false)}
              aria-label="Ẩn đoạn chat gần đây"
              className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
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
          className="flex h-7 items-center gap-1.5 rounded-md border bg-card px-2 text-xs font-medium shadow-xs transition-colors outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 md:border-transparent md:bg-transparent md:shadow-none motion-reduce:transition-none"
        >
          <Megaphone className="size-3.5" />
          Coach
        </button>
        <ChatHistoryPopover
          align="end"
          side="top"
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Lịch sử hội thoại"
              className="text-muted-foreground"
            >
              <History />
            </Button>
          }
        />
      </div>
    </>
  );
}

/**
 * Floating chat panel, bottom right. Stays mounted so minimising never loses
 * the conversation — open/close only toggles visibility.
 */
function CoachPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const thread = useCoachThread(chatSeed);
  const [input, setInput] = React.useState("");
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [open, thread.messages, thread.isTyping]);

  // Opening the panel should be immediately typable — focus the composer.
  React.useEffect(() => {
    if (open) panelRef.current?.querySelector("textarea")?.focus();
  }, [open]);

  return (
    <section
      ref={panelRef}
      role="dialog"
      aria-label="Coach"
      aria-hidden={!open}
      className={cn(
        "fixed right-4 bottom-12 z-30 flex w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-card shadow-lg",
        "h-[min(32rem,calc(100svh-7rem))]",
        open
          ? "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200"
          : "hidden",
      )}
    >
      <header className="flex shrink-0 items-center gap-0.5 border-b py-2 pr-2 pl-4">
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
          {lastChat.title}
        </h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Thu nhỏ"
              className="text-muted-foreground"
            >
              <Minus />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Thu nhỏ</TooltipContent>
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
              <Link href="/coach" aria-label="Mở toàn màn hình">
                <Maximize2 />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Mở toàn màn hình</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Đóng"
              className="text-muted-foreground"
            >
              <X />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Đóng</TooltipContent>
        </Tooltip>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <CoachMessages thread={thread} compact />
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t p-2">
        <Composer
          value={input}
          onChange={setInput}
          onSubmit={() => {
            thread.send(input);
            setInput("");
          }}
          disabled={thread.isTyping}
          compact
        />
      </div>
    </section>
  );
}
