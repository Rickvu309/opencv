import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getConversationFn,
  listConversationsFn,
} from "@/features/coach/queries";
import { useCoachSession } from "@/features/coach/components/session";
import { CoachComposer } from "@/features/coach/components/composer";
import { ChatFailed, ChatMessage, StarterChip } from "@/features/coach/components/message";
import { navigateToOpen } from "@/features/coach/open";
import { sendCoachTurn } from "@/features/coach/stream";
import { runCommand } from "@/ui/run-command";
import { checklistFn } from "@/features/onboarding/queries";
import { Row, RowList } from "@/ui/rows";

export function CoachScreen({ threadId }: { threadId?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { threadId: sessionThread, setThreadId } = useCoachSession();
  const active = threadId ?? sessionThread;
  const convos = useQuery({
    queryKey: ["conversations"],
    queryFn: () => listConversationsFn(),
  });
  const checklist = useQuery({ queryKey: ["checklist"], queryFn: () => checklistFn() });
  const thread = useQuery({
    queryKey: ["thread", active],
    queryFn: () => getConversationFn({ data: { id: active! } }),
    enabled: Boolean(active),
  });
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const offline = convos.data?.offline ?? false;
  const missingThread = Boolean(active) && thread.isFetched && thread.data === null;

  useEffect(() => {
    if (threadId) setThreadId(threadId);
  }, [threadId, setThreadId]);

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed) return;
    let id = active;
    if (!id) {
      const created = await runCommand<{ id: string }>("conversation.start", {
        title: trimmed.slice(0, 40) || "New conversation",
      });
      id = created.result.id;
      setThreadId(id);
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      await navigate({ to: "/coach", search: { thread: id } });
    }
    setReply("");
    setLastFailed(null);
    setText("");
    setWorking(true);
    let acc = "";
    try {
      const result = await sendCoachTurn({
        conversationId: id,
        text: trimmed,
        screen: "/coach",
        onText: (next) => {
          acc = next;
          setReply(next);
        },
        onOpen: (open) => {
          void navigateToOpen(navigate, open);
        },
      });
      if (!result.ok) setLastFailed(trimmed);
      else if (!acc.trim()) setReply("The Coach said nothing. Try again.");
    } finally {
      setWorking(false);
    }
    await queryClient.invalidateQueries({ queryKey: ["thread", id] });
    await queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }

  const messages = thread.data?.messages ?? [];
  const empty = messages.length === 0 && !reply;

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-2xl flex-col">
      {offline ? (
        <p className="text-ink-muted">
          The Coach is offline right now. Everything else in the app still works.
        </p>
      ) : null}
      {missingThread ? (
        <p>
          That conversation is not here.{" "}
          <button
            type="button"
            className="text-accent underline"
            onClick={() => {
              setThreadId(null);
              void navigate({ to: "/coach", search: { thread: undefined } });
            }}
          >
            Start a new one.
          </button>
        </p>
      ) : null}
      {empty && !missingThread ? (
        <>
          {checklist.data && !checklist.data.dismissed ? (
            <RowList>
              {checklist.data.items.map((i: { id: string; label: string; done: boolean }) => (
                <Row
                  key={i.id}
                  label={i.label}
                  meta={i.done ? "done" : "to do"}
                />
              ))}
            </RowList>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-2">
            {["Where do I start?", "Look at my CV", "What fits my background?"].map((s) => (
              <StarterChip key={s} label={s} onPick={() => setText(s)} />
            ))}
          </div>
        </>
      ) : null}
      <div className="mt-6 min-h-48 flex-1 space-y-3">
        {messages.map((m: { id: string; role: string; content: { text?: string }[] }) => (
          <ChatMessage
            key={m.id}
            role={m.role}
            text={Array.isArray(m.content) ? m.content.map((c) => c.text).join(" ") : ""}
          />
        ))}
        {reply ? <ChatMessage role="coach" text={reply} /> : null}
        {lastFailed ? <ChatFailed onRetry={() => void send(lastFailed)} /> : null}
      </div>
      <div className="mt-4">
        <CoachComposer
          text={text}
          onText={setText}
          onSend={() => void send(text)}
          disabled={offline}
          working={working}
        />
      </div>
    </section>
  );
}
