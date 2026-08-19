import { useCallback, useEffect, useRef, useState, type AnimationEvent, type ReactNode, type Ref } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCoachSession } from "@/features/coach/components/session";
import { ThreadBody } from "@/features/coach/components/thread";
import { Mark } from "@/ui/mark";
import { Button } from "@/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/ui/sheet";
import { Maximize2 } from "lucide-react";
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

function reduceMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CoachDockPill({
  onOpen,
  buttonRef,
}: {
  onOpen: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      data-print-hide
      className="inline-flex min-h-[var(--size-touch)] items-center gap-2 rounded-[var(--radius-control)] border border-hairline bg-surface-1 px-4 text-[13px] text-ink-muted shadow-[var(--shadow-overlay)] hover:text-ink"
      onClick={onOpen}
    >
      <Mark className="size-4" />
      Coach
    </button>
  );
}

export function CoachDockPanel({
  exiting = false,
  onClose,
  onOpenCoach,
  onAnimationEnd,
  children,
  className,
}: {
  exiting?: boolean;
  onClose: () => void;
  onOpenCoach: () => void;
  onAnimationEnd?: (event: AnimationEvent<HTMLElement>) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      data-print-hide
      aria-label="Coach"
      onAnimationEnd={onAnimationEnd}
      className={cn(
        "flex h-[min(32rem,70vh)] w-[var(--size-dock)] flex-col rounded-[var(--radius-container)] border border-hairline bg-surface-1 p-3 shadow-[var(--shadow-overlay)]",
        exiting ? "dock-leave" : "dock-enter",
        className,
      )}
    >
      <div className="flex h-10 shrink-0 items-center gap-1">
        <p className="min-w-0 flex-1 text-[15px] font-[510] tracking-[-0.012em]">Coach</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-10 shrink-0 px-0"
          aria-label="Open Coach"
          onClick={onOpenCoach}
        >
          <Maximize2 className="size-4" aria-hidden="true" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="shrink-0 px-3" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="mt-2 flex min-h-0 flex-1 flex-col">{children}</div>
    </aside>
  );
}

export function CoachDock() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { threadId, dockOpen, setDockOpen } = useCoachSession();
  const mdUp = useMdUp();
  const pillRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [exiting, setExiting] = useState(false);
  const body = <ThreadBody threadId={threadId} screen={pathname} compact />;

  const finishClose = useCallback(() => {
    restoreFocus.current = true;
    setExiting(false);
    setDockOpen(false);
  }, [setDockOpen]);

  const requestClose = useCallback(() => {
    if (!mdUp || reduceMotion()) {
      finishClose();
      return;
    }
    setExiting(true);
  }, [mdUp, finishClose]);

  function openMaster() {
    void navigate({
      to: "/coach",
      search: threadId ? { thread: threadId } : { thread: undefined },
    });
  }

  function onPanelAnimationEnd(event: AnimationEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return;
    if (!exiting) return;
    finishClose();
  }

  useEffect(() => {
    if (dockOpen || exiting) return;
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    pillRef.current?.focus();
  }, [dockOpen, exiting]);

  useEffect(() => {
    if (!mdUp || !dockOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mdUp, dockOpen, requestClose]);

  if (mdUp) {
    if (!dockOpen && !exiting) {
      return (
        <div
          data-print-hide
          className="fixed right-4 bottom-4 z-[var(--z-dock)] hidden print:hidden md:block"
        >
          <CoachDockPill buttonRef={pillRef} onOpen={() => setDockOpen(true)} />
        </div>
      );
    }
    return (
      <CoachDockPanel
        exiting={exiting}
        onClose={requestClose}
        onOpenCoach={openMaster}
        className="fixed right-4 bottom-4 z-[var(--z-dock)] hidden print:hidden md:flex"
        onAnimationEnd={onPanelAnimationEnd}
      >
        {body}
      </CoachDockPanel>
    );
  }

  return (
    <>
      {!dockOpen ? (
        <div
          data-print-hide
          className="fixed right-4 bottom-4 z-[var(--z-dock)] print:hidden md:hidden"
        >
          <CoachDockPill buttonRef={pillRef} onOpen={() => setDockOpen(true)} />
        </div>
      ) : null}
      <Sheet open={dockOpen} onOpenChange={setDockOpen}>
        <SheetContent side="bottom" className="flex flex-col p-3 print:hidden md:hidden">
          <div className="flex items-center gap-1">
            <SheetTitle className="min-w-0 flex-1">Coach</SheetTitle>
            <Button
              type="button"
              variant="ghost"
              className="size-11 shrink-0 px-0"
              aria-label="Open Coach"
              onClick={openMaster}
            >
              <Maximize2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <SheetDescription className="sr-only">
            The same conversation as Coach, beside this screen.
          </SheetDescription>
          <div className="mt-2 flex min-h-0 flex-1 flex-col">{body}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export { ThreadBody };
