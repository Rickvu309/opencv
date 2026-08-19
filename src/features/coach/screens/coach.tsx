import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getConversationFn } from "@/features/coach/queries";
import { useCoachSession } from "@/features/coach/components/session";
import { ThreadBody } from "@/features/coach/components/thread";

export function CoachScreen({ threadId }: { threadId?: string }) {
  const navigate = useNavigate();
  const { threadId: sessionThread, setThreadId } = useCoachSession();
  const active = threadId ?? sessionThread;
  const thread = useQuery({
    queryKey: ["thread", active],
    queryFn: () => getConversationFn({ data: { id: active! } }),
    enabled: Boolean(threadId),
  });
  const missingThread = Boolean(threadId) && thread.isFetched && thread.data === null;

  useEffect(() => {
    if (threadId) setThreadId(threadId);
  }, [threadId, setThreadId]);

  return (
    <section className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col">
      {missingThread ? (
        <p className="shrink-0">
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
      <ThreadBody threadId={active} screen="/coach" welcome />
    </section>
  );
}
