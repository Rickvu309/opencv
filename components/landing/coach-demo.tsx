"use client";

import * as React from "react";
import { Undo2 } from "lucide-react";

import { CoachCat } from "@/components/brand/coach-cat";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Beat = "idle" | "listen" | "reply" | "flash" | "undoable" | "undone";

/**
 * The differentiator, playable. No LLM. Scripted, interruptible, loopable.
 * Click undo to reverse the line — that is the claim, felt.
 */
export function CoachDemo() {
  const { t, m } = useT();
  const [beat, setBeat] = React.useState<Beat>("idle");
  const timers = React.useRef<number[]>([]);

  const clear = React.useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  const play = React.useCallback(() => {
    clear();
    setBeat("listen");
    timers.current.push(
      window.setTimeout(() => setBeat("reply"), 700),
      window.setTimeout(() => setBeat("flash"), 1500),
      window.setTimeout(() => setBeat("undoable"), 1900),
    );
  }, [clear]);

  React.useEffect(() => {
    play();
    return clear;
  }, [play, clear]);

  const showUser = beat !== "idle";
  const showCoach = beat === "reply" || beat === "flash" || beat === "undoable" || beat === "undone";
  const edited = beat === "flash" || beat === "undoable";
  const pose =
    beat === "listen" ? "listen" : beat === "undoable" || beat === "flash" ? "done" : "sit";

  return (
    <figure className="w-full">
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm outline outline-1 -outline-offset-1 outline-black/10">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <CoachCat size="sm" filled />
          </span>
          <span className="text-xs font-medium">{t(m.nav.coach)}</span>
        </div>

        <div className="space-y-4 bg-background px-4 py-4">
          {showUser ? (
            <div className="flex justify-end pl-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-[var(--duration-state)] motion-safe:ease-enter">
              <p className="max-w-[90%] rounded-2xl bg-muted px-3 py-2 text-[15px] leading-7">
                {t(m.landing.frameUser)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t(m.landing.demoCaption)}</p>
          )}

          {showCoach ? (
            <div className="flex gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-[var(--duration-state)] motion-safe:ease-enter">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <CoachCat size="sm" pose={pose} filled />
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-[15px] leading-7">{t(m.landing.frameCoach)}</p>
                <div
                  className={cn(
                    "rounded-lg border bg-card px-3 py-2 text-sm",
                    edited && "animate-just-changed",
                  )}
                >
                  <p className="text-xs text-muted-foreground">
                    {t(m.landing.demoArtifact)}
                  </p>
                  <p className="mt-1">
                    {edited ? t(m.landing.demoLineNow) : t(m.landing.demoLineWas)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {beat === "undoable" ? (
            <button
              type="button"
              onClick={() => setBeat("undone")}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1 text-xs text-muted-foreground transition-transform duration-[var(--duration-press)] ease-snap hover:text-foreground active:translate-y-px motion-reduce:transition-none"
            >
              <Undo2 className="size-3" />
              {t(m.common.undo)}
            </button>
          ) : null}

          {beat === "undone" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={play}
              className="h-8 text-xs text-muted-foreground"
            >
              {t(m.landing.demoReplay)}
            </Button>
          ) : null}
        </div>
      </div>
      <figcaption className="mt-3 text-sm text-pretty text-muted-foreground">
        {t(m.landing.demoCaption)}
      </figcaption>
    </figure>
  );
}
