import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  getConversationFn,
  listConversationsFn,
} from "@/features/coach/queries";
import { useCoachSession } from "@/features/coach/components/session";
import { CoachComposer } from "@/features/coach/components/composer";
import { ChatFailed, ChatMessage } from "@/features/coach/components/message";
import { ReasoningPanel } from "@/features/coach/components/thinking";
import { ToolGroup } from "@/features/coach/components/tool-card";
import { ApprovalCard } from "@/features/coach/components/approval";
import { navigateToOpen } from "@/features/coach/open";
import { sendCoachTurn } from "@/features/coach/stream";
import { paperIdFromScreen } from "@/features/paper/model";
import { runCommand } from "@/ui/run-command";
import { Mark } from "@/ui/mark";
import { Button } from "@/ui/button";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { StickToBottom } from "@/ui/stick-to-bottom";
import type { ApprovalView, ToolCallView } from "@/features/coach/model";

type ContentPart = { type?: string; text?: string; name?: string; input?: unknown; output?: unknown };

function textFromParts(content: ContentPart[] | undefined) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((c) => c.type === "text" || (!c.type && c.text))
    .map((c) => c.text ?? "")
    .join("\n");
}

function reasoningFromParts(content: ContentPart[] | undefined) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((c) => c.type === "reasoning")
    .map((c) => c.text ?? "")
    .join("");
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
  compact = false,
}: {
  threadId: string | null;
  screen: string;
  welcome?: boolean;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setThreadId, pendingIntent, takePendingIntent, coachRole, excerpt, clearExcerpt } =
    useCoachSession();
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
    clearExcerpt();
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
        role: coachRole,
        excerpt: excerpt ?? undefined,
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
          if (call.status === "completed" && call.name.startsWith("paper.")) {
            const fromScreen = paperIdFromScreen(screen);
            const rec =
              call.input && typeof call.input === "object" && !Array.isArray(call.input)
                ? (call.input as Record<string, unknown>)
                : null;
            const fromInput =
              typeof rec?.id === "string"
                ? rec.id
                : typeof rec?.paperId === "string"
                  ? rec.paperId
                  : null;
            const id = fromScreen ?? fromInput;
            if (id) void queryClient.invalidateQueries({ queryKey: ["paper", id] });
          }
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
  let persistedReasoning = "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as { role: string; content: ContentPart[] };
    if (m.role !== "user") {
      persistedReasoning = reasoningFromParts(m.content);
      break;
    }
  }
  const showLiveReasoning =
    (working && (Boolean(reasoning) || !reply)) ||
    Boolean(reasoning && reasoning !== persistedReasoning);

  const onPaper = Boolean(paperIdFromScreen(screen));
  const composer = (
    <CoachComposer
      text={text}
      onText={setText}
      onSend={() => void send(text)}
      onStop={() => abortRef.current?.abort()}
      disabled={offline}
      working={working}
      queued={queued}
      placeholder={onPaper ? "Tell me what to change on this page." : undefined}
      excerpt={excerpt}
      onClearExcerpt={clearExcerpt}
      compact={compact}
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
        welcome && !compact ? (
          <CoachEmpty composer={composer} />
        ) : (
          <>
            <div className="min-h-0 flex-1" />
            <div className="shrink-0">{composer}</div>
          </>
        )
      ) : (
        <>
          <StickToBottom>
            <div className={compact ? "space-y-2 py-1" : "space-y-3 py-2"}>
              {messages.map((m: { id: string; role: string; content: ContentPart[] }) => {
                const storedReasoning = m.role !== "user" ? reasoningFromParts(m.content) : "";
                const storedTools = toolsFromParts(m.content, m.id);
                return (
                  <div key={m.id} className="space-y-2">
                    {storedReasoning ? (
                      <ReasoningPanel content={storedReasoning} streaming={false} />
                    ) : null}
                    {storedTools.length ? <ToolGroup calls={storedTools} /> : null}
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
                );
              })}
              {pendingUser ? <ChatMessage role="user" text={pendingUser} /> : null}
              {showLiveReasoning ? (
                <ReasoningPanel content={reasoning} streaming={working && !reply} />
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
          <div className={compact ? "shrink-0 pt-2" : "shrink-0 pt-3"}>{composer}</div>
        </>
      )}
    </div>
  );
}

const EMAIL_BANNER_KEY = "openpath.email-connect-dismissed";

function EmailConnectBanner() {
  const [hidden, setHidden] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(EMAIL_BANNER_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden !== false) return null;

  function dismiss() {
    try {
      localStorage.setItem(EMAIL_BANNER_KEY, "1");
    } catch {
      /* private mode */
    }
    setHidden(true);
  }

  return (
    <div className="mt-6 flex w-full flex-col gap-3 rounded-[var(--radius-container)] border border-hairline bg-surface-1 p-3 sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink">
        <Mail className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[15px] font-[510] leading-[1.5]">Connect your email</p>
        <p className="mt-0.5 text-[13px] leading-[1.5] text-ink-muted">
          Drafts and follows up on application emails.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
          Dismiss
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => toast("Email connect is not available yet.")}
        >
          Connect
        </Button>
      </div>
    </div>
  );
}

export function CoachEmpty({ composer }: { composer: ReactNode }) {
  return (
    <div data-empty-thread className="flex min-h-0 flex-1 flex-col items-center justify-center">
      <div className="flex w-full max-w-2xl flex-col items-center">
        <Mark className="size-10 text-ink" />
        <div className="mt-8 w-full">{composer}</div>
        <EmailConnectBanner />
      </div>
    </div>
  );
}
