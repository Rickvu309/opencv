"use client";

import { z } from "zod";
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Composer } from "@/components/coach/composer";
import { CoachSessionEnded } from "@/components/coach/session-ended";
import { useCoach, useCoachSwitch } from "@/components/coach/provider";
import { coachReveal, kitFold } from "@/components/coach/motion";
import {
  CoachGreeting,
  CoachMessages,
} from "@/components/coach/thread-view";
import { discloseInner } from "@/components/ui/disclose";
import { useRouter } from "@/lib/nav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_signed-in/coach")({
  validateSearch: z.object({
    q: z.string().optional(),
  }),
  component: CoachPage,
});

function CoachPage() {
  return <CoachChat />;
}

function CoachChat() {
  const { q } = Route.useSearch();
  const asked = q?.trim() || "";
  const router = useRouter();

  // The same conversation the floating panel shows. Opening this page is a
  // change of view, not a new chat.
  const thread = useCoach();
  const { fading } = useCoachSwitch();

  // `?new=1` is gone. It existed because there was one thread and starting a
  // new one meant destroying it, so the reset had to be a URL the buttons could
  // navigate to and the page could strip again. Conversations are kept now and
  // `startNewChat` simply opens another, which every caller does directly.
  //
  // Removing it also closes a loop this change would otherwise have opened:
  // switching conversations remounts the whole subtree, including this page, so
  // an effect that read `?new=1` would have fired again on the remount it had
  // just caused, before `router.replace` had stripped the parameter.

  const answeredAsked = React.useRef(false);

  // A question handed over from another screen: answer it on open, but not
  // before the door has been checked. Firing during "checking" would spend a
  // turn that 401s, and firing while "locked" would lose the question behind
  // the sign-in form. Strip `?q=` after so a refresh does not ask it again.
  React.useEffect(() => {
    if (!asked || answeredAsked.current || thread.access !== "open") return;
    answeredAsked.current = true;
    thread.answer(asked);
    router.replaceTo("/coach", {});
  }, [asked, thread, router]);

  const isEmpty = thread.messages.length === 0 && !thread.isTyping;

  const fadeClass = cn(
    "flex h-full min-h-0 flex-col transition-opacity duration-[var(--duration-state)] motion-reduce:transition-none",
    fading ? "opacity-0 ease-exit" : "opacity-100 ease-snap",
  );

  // The door comes before everything: a composer the user cannot send from is
  // worse than being told the session ended, because it fails only after they
  // have typed.
  if (thread.access === "locked") {
    return (
      <div className={cn(fadeClass, "justify-center")}>
        <CoachSessionEnded />
      </div>
    );
  }

  // One tree so the composer never remounts when the first turn starts.
  // Empty: equal flex spacers centre the kit. Thread: the top spacer becomes
  // the message pane and the greeting collapses on the 0fr track.
  return (
    <div className={cn(fadeClass, isEmpty ? "pb-16" : "pb-0")}>
      <div
        className={cn(
          "min-h-0",
          isEmpty ? "flex-1" : "flex-1 overflow-y-auto",
        )}
      >
        {!isEmpty && (
          <div className="mx-auto w-full max-w-[46rem] px-5 py-10 sm:px-8">
            <CoachMessages thread={thread} />
          </div>
        )}
      </div>

      <div
        className={cn(
          "relative mx-auto w-full shrink-0 px-5 sm:px-8",
          isEmpty ? "max-w-[44rem] pb-0" : "max-w-[46rem] pb-6",
        )}
      >
        <div className={kitFold(isEmpty)}>
          <div className={cn(discloseInner, isEmpty && coachReveal(0))}>
            <CoachGreeting />
          </div>
        </div>

        {!isEmpty && (
          <div
            className="pointer-events-none absolute inset-x-5 -top-10 h-10 bg-gradient-to-t from-background to-transparent sm:inset-x-8"
            aria-hidden
          />
        )}

        <div className={isEmpty ? coachReveal(1) : undefined}>
          <Composer thread={thread} autoFocus={isEmpty} />
        </div>
      </div>

      <div
        className={cn(
          "min-h-0 transition-[flex-grow] duration-[var(--duration-state)] ease-exit motion-reduce:transition-none",
          isEmpty ? "grow" : "grow-0",
        )}
      />
    </div>
  );
}
