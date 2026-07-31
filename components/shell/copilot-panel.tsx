"use client";

import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { AiThinking } from "@/components/shared/ai-thinking";
import { EmptyState } from "@/components/shared/empty-state";
import { copilotScripts } from "@/lib/data/copilot-scripts";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function CopilotPanel() {
  const { state, sendCopilotMessage, setCopilotOpen } = useStore();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const surface = state.copilot.surface;
  const script = copilotScripts.find((entry) => entry.surface === surface);
  const messages = state.copilot.messagesBySurface[surface] ?? [];

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, state.copilot.thinking]);

  function handleSend(text: string) {
    if (!text.trim()) return;
    sendCopilotMessage(text);
    setDraft("");
  }

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex flex-col gap-1">
          <CopilotTag />
          <span className="text-xs text-muted-foreground">
            Context: {surface}
            {state.copilot.objectLabel ? ` · ${state.copilot.objectLabel}` : ""}
          </span>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close Copilot" onClick={() => setCopilotOpen(false)}>
          <X className="size-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 px-4 py-3">
          {messages.length === 0 ? (
            <EmptyState message="Ask Copilot about this page, or try a suggested prompt below." />
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex flex-col gap-1", message.role === "user" ? "items-end" : "items-start")}
              >
                {message.role === "copilot" ? <CopilotTag /> : null}
                <p
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {message.text}
                </p>
              </div>
            ))
          )}
          {state.copilot.thinking ? <AiThinking /> : null}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {script && script.suggestedPrompts.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-border px-4 py-2.5">
          {script.suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSend(prompt)}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="flex items-center gap-2 border-t border-border px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          handleSend(draft);
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask Copilot..."
          aria-label="Message Copilot"
        />
        <Button type="submit" size="icon-sm" aria-label="Send message">
          <Send className="size-4" />
        </Button>
      </form>
    </aside>
  );
}
