"use client";

import * as React from "react";
import { ArrowUp, Square } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useAppState } from "@/lib/actions/store";
import {
  COMPOSER_HINT_MS,
  composerHints,
  cyclingHint,
  type CyclingHint,
} from "@/lib/coach/placeholder";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";
import { type CoachThread } from "./thread";

function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}

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
 * Both lines stay mounted and stacked in the same box so a swap is a dissolve,
 * not a pop: incoming fades in while outgoing is still fading out. Opacity
 * only, a 3px shift on 15px type read as a jump. Transitions are attached
 * after first paint so the first swap already has them, instead of adding
 * `transition` in the same frame as the opacity flip (that popped). Reduced
 * motion and the first paint snap.
 */
function CyclingHintOverlay({
  current,
  previous,
  compact,
  reduced,
}: {
  current: string;
  previous: string | null;
  compact?: boolean;
  reduced: boolean;
}) {
  const [pair, setPair] = React.useState<{
    active: 0 | 1;
    layers: [string, string];
  }>({ active: 0, layers: [current, ""] });
  const [canAnimate, setCanAnimate] = React.useState(false);

  if (previous == null) {
    if (
      pair.active !== 0 ||
      pair.layers[0] !== current ||
      pair.layers[1] !== ""
    ) {
      setPair({ active: 0, layers: [current, ""] });
    }
  } else if (pair.layers[pair.active] !== current) {
    const next: 0 | 1 = pair.active === 0 ? 1 : 0;
    const layers: [string, string] = [pair.layers[0], pair.layers[1]];
    layers[next] = current;
    setPair({ active: next, layers });
  }

  React.useEffect(() => {
    setCanAnimate(true);
  }, []);

  // Keep the transition on after first paint, even when `previous` is null.
  // Gating it on `previous` attached the class in the same commit as the first
  // opacity flip, so that swap never interpolated.
  const animate = canAnimate && !reduced;
  const type = cn(
    "absolute inset-0 truncate text-base leading-6 text-muted-foreground sm:text-[15px]",
    compact ? "px-3 pt-3 sm:text-sm" : "px-4 pt-3.5",
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
    >
      {pair.layers.map((text, i) => (
        <span
          key={i}
          className={cn(
            type,
            animate &&
              "transition-[opacity] duration-[var(--duration-surface)] ease-enter",
            "motion-reduce:transition-none",
            i === pair.active ? "opacity-100" : "opacity-0",
          )}
        >
          {text}
        </span>
      ))}
    </div>
  );
}

/**
 * The composer: a textarea, and a send button.
 *
 * There used to be an answer-mode menu on the left offering "Tự động", "Tư
 * vấn", "Dữ liệu thị trường" and "Review hồ sơ", each with a sentence saying
 * what it would change. It changed nothing: the selection was local state that
 * no turn ever read, so a user who picked "Dữ liệu thị trường" got the same
 * reply as one who did not, having been told otherwise.
 *
 * Removed rather than reworded, on the precedent of "Remove five controls that
 * lied". A label that promises behaviour the product does not have is the one
 * kind of copy no rewrite can fix.
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
  const { t, m, locale } = useT();
  const pathname = usePathname();
  const state = useAppState();
  const canSend = thread.draft.trim().length > 0 && !thread.busy;
  const reduced = usePrefersReducedMotion();
  const hints = React.useMemo(
    () => composerHints(pathname, state).map((entry) => t(entry)),
    [pathname, state, t, locale],
  );
  const hint = useCyclingHint(hints, canSend || thread.busy, reduced);
  const showOverlay = thread.draft.length === 0 && !thread.busy;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) thread.submitDraft();
      }}
      className={cn(
        "border bg-card shadow-sm transition-shadow focus-within:shadow-md motion-reduce:transition-none",
        // Inside the floating panel (radius 16, padding 8): inner = 16 − 8. Standalone: 16.
        compact ? "rounded-md" : "rounded-xl",
      )}
    >
      <div className="relative">
        {showOverlay ? (
          <CyclingHintOverlay
            current={hint.current}
            previous={hint.previous}
            compact={compact}
            reduced={reduced}
          />
        ) : null}
        <textarea
          value={thread.draft}
          autoFocus={autoFocus}
          onChange={(e) => thread.setDraft(e.target.value)}
          onKeyDown={(e) => {
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

      <div className={cn("flex items-center gap-1 p-2", compact && "p-1.5")}>
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
                  "absolute inset-0 size-3.5 fill-current transition-[opacity,transform] duration-[var(--duration-press)] ease-snap motion-reduce:transition-none",
                  thread.isTyping
                    ? "scale-100 opacity-100"
                    : "scale-75 opacity-0",
                )}
              />
              <ArrowUp
                className={cn(
                  "absolute inset-0 size-3.5 transition-[opacity,transform] duration-[var(--duration-press)] ease-snap motion-reduce:transition-none",
                  thread.isTyping
                    ? "scale-75 opacity-0"
                    : "scale-100 opacity-100",
                )}
              />
            </span>
          </Button>
        </span>
      </div>
    </form>
  );
}
