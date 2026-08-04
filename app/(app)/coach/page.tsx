"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { chatSeed, coachStarters, user } from "@/lib/data";
import { Composer } from "@/components/coach/composer";
import { CoachMessages, useCoachThread } from "@/components/coach/thread";

export default function CoachPage() {
  return (
    <React.Suspense fallback={<div className="h-full" />}>
      <CoachChat />
    </React.Suspense>
  );
}

function CoachChat() {
  const params = useSearchParams();
  const isNew = params.get("new") === "1";
  const asked = params.get("q")?.trim() || "";

  const thread = useCoachThread(
    asked
      ? [{ id: "asked", role: "user", content: asked }]
      : isNew
        ? []
        : chatSeed,
  );

  const [input, setInput] = React.useState("");
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const firstRender = React.useRef(true);
  const answeredAsked = React.useRef(false);

  // A question handed over from another screen: answer it on open.
  React.useEffect(() => {
    if (!asked || answeredAsked.current) return;
    answeredAsked.current = true;
    thread.answer(asked);
  }, [asked, thread]);

  React.useEffect(() => {
    if (thread.messages.length === 0) return;
    bottomRef.current?.scrollIntoView({
      behavior: firstRender.current ? "instant" : "smooth",
      block: "end",
    });
    firstRender.current = false;
  }, [thread.messages, thread.isTyping]);

  const firstName = user.name.split(" ").slice(-2).join(" ");
  const isEmpty = thread.messages.length === 0 && !thread.isTyping;

  // Linear-style empty state: a quiet canvas with one composer in the middle.
  if (isEmpty) {
    return (
      <div className="flex h-full flex-col justify-center px-5 pb-16 sm:px-8">
        <div className="mx-auto w-full max-w-[44rem]">
          <p className="mb-5 text-center text-[15px] text-muted-foreground">
            Sẵn sàng khi bạn cần,{" "}
            <span className="font-medium text-foreground">{firstName}</span>
          </p>

          <Composer
            value={input}
            onChange={setInput}
            onSubmit={() => {
              thread.send(input);
              setInput("");
            }}
            autoFocus
          />

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {coachStarters.map((s) => (
              <button
                key={s.prompt}
                type="button"
                onClick={() => thread.send(s.prompt)}
                className="h-7 rounded-full border bg-card px-3 text-xs text-muted-foreground transition-colors outline-none hover:bg-muted/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
              >
                {s.prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[46rem] px-5 py-10 sm:px-8">
          <CoachMessages thread={thread} />
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="relative shrink-0">
        <div
          className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-background to-transparent"
          aria-hidden
        />
        <div className="mx-auto w-full max-w-[46rem] px-5 pb-6 sm:px-8">
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={() => {
              thread.send(input);
              setInput("");
            }}
            disabled={thread.isTyping}
          />
        </div>
      </div>
    </div>
  );
}
