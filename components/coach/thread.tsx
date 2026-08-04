"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Megaphone, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TypingDots } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { type ChatMessage } from "@/lib/data";
import { pickReply, type Suggestion } from "./replies";

/** `**bold**` and `*emphasis*` — the small subset the coach actually emits. */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-medium text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function CoachProse({ content }: { content: string }) {
  return (
    <div className="space-y-4">
      {content.split("\n\n").map((block, i) => {
        const numbered = block.match(/^(\d+)\.\s+([\s\S]+)$/);
        if (numbered) {
          return (
            <div key={i} className="flex gap-3">
              <span className="w-4 shrink-0 text-right font-medium tabular-nums text-muted-foreground">
                {numbered[1]}
              </span>
              <p className="min-w-0 flex-1">{inline(numbered[2])}</p>
            </div>
          );
        }
        return <p key={i}>{inline(block)}</p>;
      })}
    </div>
  );
}

export function CoachMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
        className,
      )}
    >
      <Megaphone className="size-3.5" />
    </span>
  );
}

function SuggestionCard({
  suggestion,
  accepted,
  onAccept,
  onDismiss,
}: {
  suggestion: Suggestion;
  accepted: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="max-w-md overflow-hidden rounded-xl border bg-card">
      <div className="px-4 py-3">
        <p className="text-xs text-muted-foreground">Coach đề xuất</p>
        <p className="mt-0.5 text-sm font-medium">{suggestion.label}</p>
      </div>
      <div className="border-t bg-muted/40 px-4 py-2.5">
        {accepted ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Check className="size-4 text-success" />
            {suggestion.kind === "add-opportunity"
              ? "Đã thêm vào danh sách hướng đi"
              : "Đã cập nhật Career Map"}
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onAccept}>
              <Plus className="size-3.5" />
              Đồng ý
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Để sau
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Conversation state shared by the Coach page and the floating panel. */
export function useCoachThread(initial: ChatMessage[]) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<ChatMessage[]>(initial);
  const [isTyping, setIsTyping] = React.useState(false);
  const [accepted, setAccepted] = React.useState<Record<string, boolean>>({});
  const [dismissed, setDismissed] = React.useState<Record<string, boolean>>({});

  const replyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const idCounter = React.useRef(0);

  React.useEffect(
    () => () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    },
    [],
  );

  const answer = React.useCallback((question: string) => {
    setIsTyping(true);
    const reply = pickReply(question);
    replyTimer.current = setTimeout(() => {
      setIsTyping(false);
      idCounter.current += 1;
      setMessages((prev) => [
        ...prev,
        {
          id: `coach-${idCounter.current}`,
          role: "coach",
          content: reply.content,
          suggestion: reply.suggestion,
        },
      ]);
    }, 1200);
  }, []);

  const send = React.useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || isTyping) return;
      idCounter.current += 1;
      setMessages((prev) => [
        ...prev,
        { id: `user-${idCounter.current}`, role: "user", content: text },
      ]);
      answer(text);
    },
    [answer, isTyping],
  );

  const acceptSuggestion = React.useCallback(
    (messageId: string, suggestion: Suggestion) => {
      setAccepted((prev) => ({ ...prev, [messageId]: true }));
      if (suggestion.kind === "add-opportunity") {
        toast.success("Đã thêm vào danh sách hướng đi", {
          description: "Analytics Engineer đã có trong danh sách của bạn.",
          action: {
            label: "Xem danh sách",
            onClick: () => router.push("/opportunities"),
          },
        });
      } else {
        toast.success("Đã cập nhật Career Map", {
          description: "Mục tiêu Power BI đã được ghim vào lộ trình của bạn.",
          action: {
            label: "Xem Career Map",
            onClick: () => router.push("/career-map"),
          },
        });
      }
    },
    [router],
  );

  const dismissSuggestion = React.useCallback((messageId: string) => {
    setDismissed((prev) => ({ ...prev, [messageId]: true }));
  }, []);

  return {
    messages,
    isTyping,
    accepted,
    dismissed,
    send,
    answer,
    acceptSuggestion,
    dismissSuggestion,
  };
}

export type CoachThread = ReturnType<typeof useCoachThread>;

export function CoachMessages({
  thread,
  compact,
}: {
  thread: CoachThread;
  compact?: boolean;
}) {
  const { messages, isTyping, accepted, dismissed } = thread;

  return (
    <div className={cn("space-y-8", compact && "space-y-6")}>
      {messages.map((message) =>
        message.role === "user" ? (
          <div key={message.id} className="flex justify-end pl-8">
            <div
              className={cn(
                "rounded-2xl bg-muted px-4 py-2.5 leading-7",
                compact ? "text-sm leading-6" : "text-[15px]",
              )}
            >
              {message.content}
            </div>
          </div>
        ) : (
          <div key={message.id} className={cn("flex gap-4", compact && "gap-3")}>
            <CoachMark className={compact ? "size-6" : undefined} />
            <div
              className={cn(
                "min-w-0 flex-1 space-y-4",
                compact ? "text-sm leading-6" : "text-[15px] leading-7",
              )}
            >
              <CoachProse content={message.content} />
              {message.suggestion && !dismissed[message.id] && (
                <SuggestionCard
                  suggestion={message.suggestion}
                  accepted={!!accepted[message.id]}
                  onAccept={() =>
                    thread.acceptSuggestion(message.id, message.suggestion!)
                  }
                  onDismiss={() => thread.dismissSuggestion(message.id)}
                />
              )}
            </div>
          </div>
        ),
      )}

      {isTyping && (
        <div className={cn("flex gap-4", compact && "gap-3")}>
          <CoachMark className={compact ? "size-6" : undefined} />
          <TypingDots className="h-7 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
