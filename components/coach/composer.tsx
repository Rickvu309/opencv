"use client";

import * as React from "react";
import { ArrowUp, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";
import { type CoachThread } from "./thread";

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
  const canSend = thread.draft.trim().length > 0 && !thread.busy;

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
        placeholder={t(m.coach.composerPlaceholder)}
        aria-label={t(m.coach.composerPlaceholder)}
        rows={1}
        className={cn(
          // text-base on mobile: iOS Safari zooms the page when an input is under 16px.
          "field-sizing-content max-h-40 w-full resize-none bg-transparent px-4 pt-3.5 text-base leading-6 outline-none placeholder:text-muted-foreground sm:text-[15px]",
          compact && "px-3 pt-3 sm:text-sm",
        )}
      />

      <div className={cn("flex items-center gap-1 p-2", compact && "p-1.5")}>
        <span className="ml-auto flex items-center gap-1">
          {/* One button, two jobs, because they are never both available and a
              second control would sit dead most of the time. The Coach reasons
              before it answers and a turn can run past fifty seconds; without
              this the only way out of a slow one is reloading the page. */}
          {thread.isTyping ? (
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              onClick={thread.stop}
              aria-label={t(m.coach.stop)}
              className="rounded-full"
            >
              <Square className="fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon-sm"
              disabled={!canSend}
              aria-label={t(m.coach.send)}
              className="rounded-full"
            >
              <ArrowUp />
            </Button>
          )}
        </span>
      </div>
    </form>
  );
}
