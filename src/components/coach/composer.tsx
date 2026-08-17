"use client";

import * as React from "react";
import { ArrowUp, PenLine, Plus, Square } from "lucide-react";
import { usePathname } from "@/lib/nav";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppState } from "@/lib/actions/store";
import {
  COMPOSER_HINT_MS,
  composerHints,
  cyclingHint,
  type CyclingHint,
} from "@/lib/coach/placeholder";
import { applySlash, filterBySlash, slashToken } from "@/lib/coach/slash";
import { coachStarters } from "@/lib/coach/starters";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";
import {
  TextSwap,
  iconSwapIn,
  iconSwapItem,
  iconSwapOut,
  usePrefersReducedMotion,
} from "./motion";
import { type CoachThread } from "./thread";

function useCyclingHint(
  hints: readonly string[],
  pause: boolean,
  reduced: boolean,
): CyclingHint {
  const [index, setIndex] = React.useState(0);
  const [swapped, setSwapped] = React.useState(false);
  const key = hints.join("\0");

  React.useEffect(() => {
    setIndex(0);
    setSwapped(false);
  }, [key]);

  React.useEffect(() => {
    if (pause || reduced || hints.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % hints.length);
      setSwapped(true);
    }, COMPOSER_HINT_MS);
    return () => window.clearInterval(id);
  }, [pause, reduced, hints.length, key]);

  return cyclingHint(hints, index, swapped);
}

/**
 * Decorative stand-in for the textarea placeholder, which cannot crossfade.
 *
 * One line, transitions.dev text-states-swap: old hint exits 4px up with a
 * 2px blur, new hint enters from below. Reduced motion snaps. The accessible
 * name on the textarea stays put.
 */
function CyclingHintOverlay({
  current,
  compact,
}: {
  current: string;
  compact?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-[1] overflow-hidden",
        compact ? "px-3 pt-3" : "px-4 pt-3.5",
      )}
    >
      <TextSwap
        text={current}
        className={cn(
          "max-w-full truncate text-base leading-6 text-muted-foreground sm:text-[15px]",
          compact && "sm:text-sm",
        )}
      />
    </div>
  );
}

function toolButtonClass(compact?: boolean) {
  return cn(
    "text-muted-foreground",
    compact && "size-6",
  );
}

/**
 * One + control. Open, it rotates 45° like a standard chat bar. The menu
 * holds a new thread and the state-aware asks — not models, files, or a
 * mode the turn would ignore.
 */
function ComposerTools({
  thread,
  compact,
}: {
  thread: CoachThread;
  compact?: boolean;
}) {
  const { t, m } = useT();
  const state = useAppState();
  const [open, setOpen] = React.useState(false);
  const starters = React.useMemo(
    () => coachStarters(state).map(t),
    [state, t],
  );
  const ask = (prompt: string) => {
    if (!thread.busy) thread.send(prompt);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={thread.busy}
              aria-label={t(m.coach.composerAdd)}
              aria-expanded={open}
              data-open={open || undefined}
              className={cn(
                toolButtonClass(compact),
                "rounded-full",
                open && "bg-muted text-foreground",
              )}
            >
              <Plus
                className={cn(
                  "transition-transform duration-[var(--duration-state)] ease-enter motion-reduce:transition-none",
                  open && "rotate-45",
                )}
              />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">{t(m.coach.composerAdd)}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" side="top" className="w-72">
        <DropdownMenuItem onSelect={() => thread.startNewChat()}>
          <PenLine />
          {t(m.coach.startNewChat)}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t(m.coach.startersLabel)}</DropdownMenuLabel>
        {starters.map((prompt) => (
          <DropdownMenuItem
            key={prompt}
            disabled={thread.busy}
            onSelect={() => ask(prompt)}
          >
            {prompt}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SlashPalette({
  results,
  active,
  compact,
  onPick,
  onHover,
}: {
  results: readonly string[];
  active: number;
  compact?: boolean;
  onPick: (prompt: string) => void;
  onHover: (index: number) => void;
}) {
  const { t, m } = useT();

  return (
    <div
      role="listbox"
      aria-label={t(m.coach.startersLabel)}
      className={cn(
        "absolute inset-x-2 bottom-full z-10 mb-1 max-h-48 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md",
        compact && "inset-x-1.5",
      )}
    >
      <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
        {t(m.coach.startersLabel)}
      </div>
      {results.length === 0 ? (
        <div className="px-1.5 py-1.5 text-sm text-muted-foreground">
          {t(m.coach.slashEmpty)}
        </div>
      ) : (
        results.map((prompt, index) => (
          <button
            key={prompt}
            type="button"
            role="option"
            aria-selected={index === active}
            className={cn(
              "flex w-full rounded-md px-1.5 py-1.5 text-left text-sm outline-none",
              index === active
                ? "bg-accent text-accent-foreground"
                : "text-foreground",
            )}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onHover(index)}
            onClick={() => onPick(prompt)}
          >
            {prompt}
          </button>
        ))
      )}
    </div>
  );
}

/**
 * The composer: a textarea, one + menu, slash suggestions, and a send button.
 *
 * There used to be an answer-mode menu on the left offering "Tự động", "Tư
 * vấn", "Dữ liệu thị trường" and "Review hồ sơ", each with a sentence saying
 * what it would change. It changed nothing. + holds a new thread and the
 * same state-aware questions the placeholder cycles. `/` opens those
 * questions as a palette and inserts one — it does not invent skills, models,
 * or an enhance step we cannot run.
 *
 * Takes the thread rather than value/onChange/onSubmit/disabled, the same way
 * `CoachMessages` does. Three mounts wiring those four props by hand is three
 * chances to wire them differently, and they had: the empty state on `/coach`
 * left `disabled` off, so its send button stayed lit through a turn.
 *
 * The placeholder is not a fixed "Hỏi Coach…". It cycles the same questions
 * the suggestions pick from state, and leads with a line for the page you are on
 * when this composer sits in the dock. A native placeholder cannot fade, so an
 * empty field paints those lines in a decorative overlay that crossfades on
 * swap. The accessible name stays put, so a screen reader is not told a new
 * label every few seconds.
 */
export function Composer({
  thread,
  autoFocus,
  compact,
}: {
  thread: CoachThread;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const { t, m } = useT();
  const pathname = usePathname();
  const state = useAppState();
  const canSend = thread.draft.trim().length > 0 && !thread.busy;
  const reduced = usePrefersReducedMotion();
  const hints = React.useMemo(
    () => composerHints(pathname, state).map((entry) => t(entry)),
    [pathname, state, t],
  );
  const hint = useCyclingHint(hints, canSend || thread.busy, reduced);
  const showOverlay = thread.draft.length === 0 && !thread.busy;
  const starters = React.useMemo(
    () => coachStarters(state).map(t),
    [state, t],
  );
  const slash = slashToken(thread.draft);
  const slashResults = React.useMemo(
    () => (slash ? filterBySlash(starters, slash.query) : []),
    [slash, starters],
  );
  const slashOpen = Boolean(slash) && !thread.busy;
  const [slashIndex, setSlashIndex] = React.useState(0);

  React.useEffect(() => {
    setSlashIndex(0);
  }, [slash?.query]);

  React.useEffect(() => {
    if (slashIndex >= slashResults.length) setSlashIndex(0);
  }, [slashIndex, slashResults.length]);

  const pickSlash = (prompt: string) => {
    if (!slash) return;
    thread.setDraft(applySlash(thread.draft, slash.from, prompt));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) thread.submitDraft();
      }}
      className={cn(
        "relative bg-card ring-1 ring-border",
        "transition-[box-shadow] duration-[var(--duration-state)] ease-enter",
        "focus-within:ring-3 focus-within:ring-ring/50",
        "motion-reduce:transition-none",
        // Inside the floating panel (radius 16, padding 8): inner = 16 − 8. Standalone: 16.
        compact ? "rounded-md" : "rounded-xl",
      )}
    >
      <div className="relative">
        {showOverlay ? (
          <CyclingHintOverlay current={hint.current} compact={compact} />
        ) : null}
        <textarea
          value={thread.draft}
          autoFocus={autoFocus}
          onChange={(e) => thread.setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (slashOpen && slashResults.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSlashIndex((i) => (i + 1) % slashResults.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSlashIndex(
                  (i) => (i - 1 + slashResults.length) % slashResults.length,
                );
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                pickSlash(slashResults[slashIndex] ?? slashResults[0]);
                return;
              }
            }
            if (slashOpen && e.key === "Escape") {
              e.preventDefault();
              thread.setDraft(thread.draft.slice(0, slash?.from ?? 0));
              return;
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (canSend) thread.submitDraft();
            }
          }}
          placeholder={showOverlay ? undefined : hint.current || undefined}
          aria-label={t(m.coach.composerPlaceholder)}
          rows={1}
          className={cn(
            // text-base on mobile: iOS Safari zooms the page when an input is under 16px.
            "relative field-sizing-content max-h-40 w-full resize-none bg-transparent px-4 pt-3.5 text-base leading-6 outline-none placeholder:text-muted-foreground sm:text-[15px]",
            compact && "px-3 pt-3 sm:text-sm",
          )}
        />
      </div>

      <div className={cn("relative flex items-center gap-1 p-2", compact && "p-1.5")}>
        {slashOpen ? (
          <SlashPalette
            results={slashResults}
            active={slashIndex}
            compact={compact}
            onPick={pickSlash}
            onHover={setSlashIndex}
          />
        ) : null}
        <ComposerTools thread={thread} compact={compact} />
        <span className="ml-auto flex items-center gap-1">
          {/* One button, two jobs, because they are never both available and a
              second control would sit dead most of the time. The Coach reasons
              before it answers and a turn can run past fifty seconds; without
              this the only way out of a slow one is reloading the page. */}
          <Button
            type={thread.isTyping ? "button" : "submit"}
            size="icon-sm"
            variant={thread.isTyping ? "secondary" : "default"}
            disabled={!thread.isTyping && !canSend}
            onClick={thread.isTyping ? thread.stop : undefined}
            aria-label={t(thread.isTyping ? m.coach.stop : m.coach.send)}
            className="rounded-full"
          >
            <span className="relative size-3.5">
              <Square
                className={cn(
                  iconSwapItem,
                  "fill-current",
                  thread.isTyping ? iconSwapIn : iconSwapOut,
                )}
              />
              <ArrowUp
                className={cn(
                  iconSwapItem,
                  thread.isTyping ? iconSwapOut : iconSwapIn,
                )}
              />
            </span>
          </Button>
        </span>
      </div>
    </form>
  );
}
