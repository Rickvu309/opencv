import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getConversationFn, listConversationsFn } from "@/features/coach/queries";
import { useCoachSession } from "@/features/coach/components/session";
import { CoachComposer } from "@/features/coach/components/composer";
import { ChatFailed, ChatMessage } from "@/features/coach/components/message";
import { navigateToOpen } from "@/features/coach/open";
import { sendCoachTurn } from "@/features/coach/stream";
import { MessageSquare } from "lucide-react";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/ui/sheet";

function useMdUp() {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setUp(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return up;
}

function ThreadBody({
  threadId,
  screen,
}: {
  threadId: string | null;
  screen: string;
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
  const [reply, setReply] = useState("");
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const offline = convos.data?.offline ?? thread.data?.offline ?? false;

  useEffect(() => {
    if (!pendingIntent) return;
    const next = takePendingIntent();
    if (next) setText(next);
  }, [pendingIntent, takePendingIntent]);

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed) return;
    let id = threadId;
    if (!id) {
      const created = await runCommand<{ id: string }>("conversation.start", {
        title: trimmed.slice(0, 40) || "New conversation",
      });
      id = created.result.id;
      setThreadId(id);
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
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
        screen,
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {offline ? (
        <p className="text-ink-muted">
          The Coach is offline right now. Everything else in the app still works.
        </p>
      ) : null}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
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
      <div className="mt-3">
        <CoachComposer
          text={text}
          onText={setText}
          onSend={() => void send(text)}
          disabled={offline}
          working={working}
        />
      </div>
    </div>
  );
}

export function CoachDock() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { threadId, dockOpen, setDockOpen } = useCoachSession();
  const mdUp = useMdUp();
  const body = (
    <ThreadBody threadId={threadId} screen={pathname} />
  );

  if (mdUp) {
    if (!dockOpen) {
      return (
        <button
          type="button"
          data-print-hide
          className="fixed right-4 bottom-4 z-[var(--z-dock)] hidden min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-hairline bg-surface-1 px-4 text-[13px] shadow-[var(--shadow-overlay)] print:hidden md:flex md:items-center"
          onClick={() => setDockOpen(true)}
        >
          <MessageSquare className="size-4" aria-hidden="true" />
          Coach
        </button>
      );
    }
    return (
      <aside
        data-print-hide
        className="dock-enter fixed right-4 bottom-4 z-[var(--z-dock)] hidden h-[min(32rem,70vh)] w-[var(--size-dock)] flex-col rounded-[var(--radius-container)] border border-hairline bg-surface-1 p-4 shadow-[var(--shadow-overlay)] print:hidden md:flex"
        aria-label="Coach"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[15px] font-[510] tracking-[-0.012em]">Coach</p>
          <Button variant="ghost" className="min-h-11 px-3" onClick={() => setDockOpen(false)}>
            Close
          </Button>
        </div>
        {body}
      </aside>
    );
  }

  return (
    <>
      {!dockOpen ? (
        <button
          type="button"
          data-print-hide
          className="fixed right-4 bottom-4 z-[var(--z-dock)] flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-hairline bg-surface-1 px-4 text-[13px] shadow-[var(--shadow-overlay)] print:hidden md:hidden"
          onClick={() => setDockOpen(true)}
        >
          <MessageSquare className="size-4" aria-hidden="true" />
          Coach
        </button>
      ) : null}
      <Sheet open={dockOpen} onOpenChange={setDockOpen}>
        <SheetContent side="bottom" className="flex flex-col p-4 print:hidden md:hidden">
          <SheetTitle>Coach</SheetTitle>
          <SheetDescription className="sr-only">
            The same conversation as Chat, beside this screen.
          </SheetDescription>
          <div className="mt-3 flex min-h-0 flex-1 flex-col">{body}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export { ThreadBody };
