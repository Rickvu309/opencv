"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { Composer } from "@/components/coach/composer";
import { ActivationChecklist } from "@/components/onboarding/activation-checklist";
import { CoachSessionEnded } from "@/components/coach/session-ended";
import { useCoach } from "@/components/coach/provider";
import {
  CoachGreeting,
  CoachMessages,
  CoachStarters,
} from "@/components/coach/thread-view";

export default function CoachPage() {
  return (
    <React.Suspense fallback={<div className="h-full" />}>
      <CoachChat />
    </React.Suspense>
  );
}

function CoachChat() {
  const params = useSearchParams();
  const asked = params.get("q")?.trim() || "";

  // The same conversation the floating panel shows. Opening this page is a
  // change of view, not a new chat.
  const thread = useCoach();

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
  // the sign-in form.
  React.useEffect(() => {
    if (!asked || answeredAsked.current || thread.access !== "open") return;
    answeredAsked.current = true;
    thread.answer(asked);
  }, [asked, thread]);

  const isEmpty = thread.messages.length === 0 && !thread.isTyping;

  // The door comes before everything: a composer the user cannot send from is
  // worse than being told the session ended, because it fails only after they
  // have typed.
  if (thread.access === "locked") {
    return (
      <div className="flex h-full flex-col justify-center">
        <CoachSessionEnded />
      </div>
    );
  }

  // Linear-style empty state: a quiet canvas with one composer in the middle.
  if (isEmpty) {
    return (
      <div className="flex h-full flex-col justify-center px-5 pb-16 sm:px-8">
        <div className="mx-auto w-full max-w-[44rem] space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-[var(--duration-state)] motion-safe:ease-enter">
          <CoachGreeting />
          <Composer thread={thread} autoFocus />
          {/* A seeded question from onboarding is the introduction. Starters
              under it would compete with the turn that is about to start. */}
          {!asked && <CoachStarters thread={thread} />}
          {/* On the empty state only. Somebody mid-conversation has already
              found their way in and does not need a list of first steps under
              the thread they are reading. */}
          <ActivationChecklist />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[46rem] px-5 py-10 sm:px-8">
          <CoachMessages thread={thread} />
        </div>
      </div>

      <div className="relative shrink-0">
        <div
          className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-background to-transparent"
          aria-hidden
        />
        <div className="mx-auto w-full max-w-[46rem] px-5 pb-6 sm:px-8">
          <Composer thread={thread} />
        </div>
      </div>
    </div>
  );
}
