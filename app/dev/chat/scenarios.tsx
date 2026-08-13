"use client";

import * as React from "react";

import type { EveMessage } from "eve/react";

import { CoachMessages } from "@/components/coach/thread-view";
import { flatten, type CoachMessage } from "@/lib/coach/messages";
import type { CoachThread } from "@/components/coach/thread";

/**
 * A thread that renders but does nothing.
 *
 * `CoachMessages` reads a handful of fields off the real thread and calls back
 * into it only when the user answers a parked question. Everything else is
 * projection, which is exactly what this harness exists to look at, so the
 * callbacks are stubs rather than a second implementation that could disagree
 * with the first.
 */
function stubThread(messages: CoachMessage[], isTyping: boolean): CoachThread {
  return {
    messages,
    isTyping,
    busy: isTyping,
    draft: "",
    setDraft: () => {},
    submitDraft: () => {},
    startNewChat: () => {},
    conversations: [],
    conversationId: "harness",
    switchTo: () => {},
    deleteConversation: () => {},
    send: () => {},
    stop: () => {},
    answer: () => {},
    respond: () => {},
    access: "open",
    signingIn: false,
    signInError: null,
    signIn: () => {},
  };
}

export function DevChatScenarios({
  scenarios,
}: {
  scenarios: { id: string; label: string; messages: EveMessage[] }[];
}) {
  const [compact, setCompact] = React.useState(false);

  return (
    <>
      <label className="mt-6 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={compact}
          onChange={(e) => setCompact(e.target.checked)}
        />
        Compact (the floating panel&apos;s density)
      </label>

      <div className="mt-8 space-y-10">
        {scenarios.map((scenario) => {
          const messages = scenario.messages
            .map(flatten)
            .filter((m): m is CoachMessage => m !== null);
          // A scenario whose last message is still streaming shows the typing
          // indicator too, because that is what the user would be looking at.
          const streaming = messages.some((m) => m.reasoning?.streaming);

          return (
            <section key={scenario.id} className="space-y-3">
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {scenario.label}
              </h2>
              <div className="rounded-xl border bg-card p-5">
                <CoachMessages
                  thread={stubThread(messages, streaming)}
                  compact={compact}
                />
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
