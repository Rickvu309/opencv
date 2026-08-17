import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getConversationFn, listConversationsFn } from "@/features/coach/queries";
import { useCoachSession } from "@/features/coach/components/session";
import { CoachComposer } from "@/features/coach/components/composer";
import { navigateToOpen } from "@/features/coach/open";
import { sendCoachTurn } from "@/features/coach/stream";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/ui/sheet";
import { cn } from "@/lib/utils";

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
  compact,
}: {
  threadId: string | null;
  screen: string;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setThreadId } = useCoachSession();
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
  const offline = convos.data?.offline ?? thread.data?.offline ?? false;

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
    let acc = "";
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
    await queryClient.invalidateQueries({ queryKey: ["thread", id] });
    await queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }

  const messages = thread.data?.messages ?? [];

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", compact && "text-[14px]")}>
      {offline ? (
        <p className="text-muted-foreground">
          The Coach is offline right now. Everything else in the app still works.
        </p>
      ) : null}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {messages.map((m: { id: string; role: string; content: { text?: string }[] }) => (
          <p key={m.id}>
            <span className="text-[14px] text-muted-foreground">{m.role}: </span>
            {Array.isArray(m.content) ? m.content.map((c) => c.text).join(" ") : ""}
          </p>
        ))}
        {reply ? <p>{reply}</p> : null}
        {lastFailed ? (
          <div>
            <p className="text-muted-foreground">The Coach didn&apos;t reply. Try again.</p>
            <Button className="mt-2" variant="outline" onClick={() => void send(lastFailed)}>
              Retry
            </Button>
          </div>
        ) : null}
      </div>
      <div className="mt-3">
        <CoachComposer
          text={text}
          onText={setText}
          onSend={() => void send(text)}
          disabled={offline}
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
    <ThreadBody threadId={threadId} screen={pathname} compact />
  );

  if (mdUp) {
    if (!dockOpen) {
      return (
        <button
          type="button"
          className="fixed right-4 bottom-4 z-30 hidden min-h-11 rounded-[var(--radius-control)] border border-border bg-background px-4 text-[14px] shadow-sm md:flex md:items-center"
          onClick={() => setDockOpen(true)}
        >
          Coach
        </button>
      );
    }
    return (
      <aside
        className="fixed right-4 bottom-4 z-30 hidden h-[min(32rem,70vh)] w-80 flex-col rounded-[var(--radius-card)] border border-border bg-background p-4 shadow-sm md:flex"
        aria-label="Coach"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[14px] font-medium">Coach</p>
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
          className="fixed right-4 bottom-4 z-30 min-h-11 rounded-[var(--radius-control)] border border-border bg-background px-4 text-[14px] shadow-sm md:hidden"
          onClick={() => setDockOpen(true)}
        >
          Coach
        </button>
      ) : null}
      <Sheet open={dockOpen} onOpenChange={setDockOpen}>
        <SheetContent side="bottom" className="flex flex-col p-4 md:hidden">
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
