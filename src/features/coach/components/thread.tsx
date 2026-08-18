import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  getConversationFn,
  listConversationsFn,
} from "@/features/coach/queries";
import { useCoachSession } from "@/features/coach/components/session";
import { CoachComposer } from "@/features/coach/components/composer";
import { ChatFailed, ChatMessage, StarterChip } from "@/features/coach/components/message";
import { ThinkingCard } from "@/features/coach/components/thinking";
import { ToolGroup } from "@/features/coach/components/tool-card";
import { ApprovalCard } from "@/features/coach/components/approval";
import { navigateToOpen } from "@/features/coach/open";
import { sendCoachTurn } from "@/features/coach/stream";
import { runCommand } from "@/ui/run-command";
import { checklistFn } from "@/features/onboarding/queries";
import { Row, RowList } from "@/ui/rows";
import { StickToBottom } from "@/ui/stick-to-bottom";
import type { ApprovalView, ToolCallView } from "@/features/coach/model";

type ContentPart = { type?: string; text?: string; name?: string; input?: unknown; output?: unknown };

function textFromParts(content: ContentPart[] | undefined) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((c) => c.type === "text" || c.text)
    .map((c) => c.text ?? "")
    .join("\n");
}

function toolsFromParts(content: ContentPart[] | undefined, idPrefix: string): ToolCallView[] {
  if (!Array.isArray(content)) return [];
  return content
    .filter((c) => c.type === "tool" && c.name)
    .map((c, i) => ({
      id: `${idPrefix}-${i}`,
      name: c.name!,
      input: c.input,
      output: c.output,
      status: "completed" as const,
    }));
}

export function ThreadBody({
  threadId,
  screen,
  welcome = false,
}: {
  threadId: string | null;
  screen: string;
  welcome?: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setThreadId, pendingIntent, takePendingIntent } = useCoachSession();
  const convos = useQuery({
    queryKey: ["conversations"],
    queryFn: () => listConversationsFn(),
  });
  const thread = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => getConversationFn({ data: { id: threadId! } }),
    enabled: Boolean(threadId),
  });
  const [text, setText] = useState("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [tools, setTools] = useState<ToolCallView[]>([]);
  const [approvals, setApprovals] = useState<ApprovalView[]>([]);
  const [grants, setGrants] = useState<string[]>([]);
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [queued, setQueued] = useState<string | null>(null);
  const queuedRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const toolsRef = useRef<ToolCallView[]>([]);
  const offline = Boolean(convos.data?.offline);
  useEffect(() => {
    if (!pendingIntent) return;
    const next = takePendingIntent();
    if (next) setText(next);
  }, [pendingIntent, takePendingIntent]);

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed) return;
    if (working) {
      queuedRef.current = trimmed;
      setQueued(trimmed);
      setText("");
      return;
    }
    let id = threadId;
    if (!id) {
      const created = await runCommand<{ id: string }>("conversation.start", {
        title: trimmed.slice(0, 40) || "New conversation",
      });
      id = created.result.id;
      setThreadId(id);
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (screen === "/coach") {
        await navigate({ to: "/coach", search: { thread: id } });
      }
    }
    setReply("");
    setReasoning("");
    setTools([]);
    toolsRef.current = [];
    setApprovals([]);
    setLastFailed(null);
    setPendingUser(trimmed);
    setText("");
    setWorking(true);
    const abort = new AbortController();
    abortRef.current = abort;
    let acc = "";
    try {
      const result = await sendCoachTurn({
        conversationId: id,
        text: trimmed,
        screen,
        grants,
        signal: abort.signal,
        onText: (next) => {
          acc = next;
          setReply(next);
        },
        onReasoning: setReasoning,
        onTool: (call) => {
          setTools((prev) => {
            const i = prev.findIndex((c) => c.id === call.id);
            const next =
              i === -1 ? [...prev, call] : prev.map((c, idx) => (idx === i ? { ...c, ...call } : c));
            toolsRef.current = next;
            return next;
          });
        },
        onApproval: (approval) => {
          setApprovals((prev) => [...prev, approval]);
        },
        onOpen: (open) => {
          void navigateToOpen(navigate, open);
        },
        onError: () => setLastFailed(trimmed),
      });
      if (!result.ok) setLastFailed(trimmed);
      else if (!acc.trim() && toolsRef.current.length === 0) {
        setReply("The Coach said nothing. Try again.");
      }
    } catch (e) {
      if ((e as { name?: string }).name !== "AbortError") setLastFailed(trimmed);
    } finally {
      setWorking(false);
      abortRef.current = null;
      setPendingUser(null);
    }
    await queryClient.invalidateQueries({ queryKey: ["thread", id] });
    await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    const nextQueued = queuedRef.current;
    queuedRef.current = null;
    setQueued(null);
    if (nextQueued) void send(nextQueued);
  }

  const messages = thread.data?.messages ?? [];
  const empty = messages.length === 0 && !reply && !pendingUser;

  const composer = (
    <CoachComposer
      text={text}
      onText={setText}
      onSend={() => void send(text)}
      onStop={() => abortRef.current?.abort()}
      disabled={offline}
      working={working}
      queued={queued}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {offline ? (
        <p className="shrink-0 text-[13px] text-ink-muted">
          The Coach is offline right now. Everything else in the app still works.
        </p>
      ) : null}
      {empty ? (
        welcome ? (
          <CoachEmpty composer={composer} onPick={setText} />
        ) : (
          <>
            <div className="min-h-0 flex-1" />
            <div className="shrink-0">{composer}</div>
          </>
        )
      ) : (
        <>
          <StickToBottom>
            <div className="space-y-3 py-2">
              {messages.map(
                (m: { id: string; role: string; content: ContentPart[] }) => (
                  <div key={m.id} className="space-y-2">
                    {toolsFromParts(m.content, m.id).length ? (
                      <ToolGroup calls={toolsFromParts(m.content, m.id)} />
                    ) : null}
                    <ChatMessage
                      role={m.role}
                      text={textFromParts(m.content)}
                      onCopy={
                        m.role !== "user"
                          ? () => void navigator.clipboard.writeText(textFromParts(m.content))
                          : undefined
                      }
                      onRetry={
                        m.role === "user" ? () => void send(textFromParts(m.content)) : undefined
                      }
                    />
                  </div>
                ),
              )}
              {pendingUser ? <ChatMessage role="user" text={pendingUser} /> : null}
              {reasoning || working ? (
                <ThinkingCard content={reasoning} isStreaming={working && !reply} />
              ) : null}
              {tools.length ? <ToolGroup calls={tools} /> : null}
              {approvals.map((a, i) => (
                <ApprovalCard
                  key={`${a.command}-${i}`}
                  approval={a}
                  onDecided={(kind) => {
                    if (kind === "session") {
                      setGrants((g) => [...g, a.command]);
                    }
                    setApprovals((prev) => prev.filter((_, j) => j !== i));
                    void queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
                  }}
                />
              ))}
              {reply ? (
                <ChatMessage
                  role="coach"
                  text={reply}
                  onCopy={() => void navigator.clipboard.writeText(reply)}
                />
              ) : null}
              {lastFailed ? <ChatFailed onRetry={() => void send(lastFailed)} /> : null}
            </div>
          </StickToBottom>
          <div className="shrink-0 pt-3">{composer}</div>
        </>
      )}
    </div>
  );
}

export function CoachEmpty({
  composer,
  onPick,
}: {
  composer: ReactNode;
  onPick: (label: string) => void;
}) {
  const checklist = useQuery({ queryKey: ["checklist"], queryFn: () => checklistFn() });
  return (
    <div data-empty-thread className="flex min-h-0 flex-1 flex-col items-center justify-center">
      <div className="w-full">
        <p className="text-balance text-center text-[24px] font-[590] leading-[1.3] tracking-[-0.017em]">
          Where should we start?
        </p>
        {checklist.data && !checklist.data.dismissed ? (
          <div className="mt-5">
            <RowList>
              {checklist.data.items.map((i: { id: string; label: string; done: boolean }) => (
                <Row key={i.id} label={i.label} meta={i.done ? "done" : "to do"} />
              ))}
            </RowList>
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {["Where do I start?", "Look at my CV", "What fits my background?"].map((s) => (
            <StarterChip key={s} label={s} onPick={() => onPick(s)} />
          ))}
        </div>
        <div className="mt-6">{composer}</div>
      </div>
    </div>
  );
}
