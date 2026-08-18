import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useCoachSession } from "@/features/coach/components/session";
import { ThreadBody } from "@/features/coach/components/thread";
import { MessageSquare } from "lucide-react";
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

export function CoachDock() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { threadId, dockOpen, setDockOpen } = useCoachSession();
  const mdUp = useMdUp();
  const body = <ThreadBody threadId={threadId} screen={pathname} />;

  if (mdUp) {
    if (!dockOpen) {
      return (
        <button
          type="button"
          data-print-hide
          className="fixed right-4 bottom-4 z-[var(--z-dock)] hidden min-h-[var(--size-touch)] items-center gap-2 rounded-[var(--radius-control)] border border-hairline bg-surface-1 px-4 text-[13px] shadow-[var(--shadow-overlay)] print:hidden md:flex md:items-center"
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
          <Button variant="ghost" className="min-h-[var(--size-touch)] px-3" onClick={() => setDockOpen(false)}>
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
          className="fixed right-4 bottom-4 z-[var(--z-dock)] flex min-h-[var(--size-touch)] items-center gap-2 rounded-[var(--radius-control)] border border-hairline bg-surface-1 px-4 text-[13px] shadow-[var(--shadow-overlay)] print:hidden md:hidden"
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
            The same conversation as Coach, beside this screen.
          </SheetDescription>
          <div className="mt-3 flex min-h-0 flex-1 flex-col">{body}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export { ThreadBody };
