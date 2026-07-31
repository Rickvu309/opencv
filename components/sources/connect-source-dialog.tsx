"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import type { ConnectedSource } from "@/lib/types";

const STEP_TITLES = ["What OpenPath will read", "What it unlocks", "Connecting"];
const TOTAL_STEPS = STEP_TITLES.length;
const CONNECT_DELAY_MS = 900;

function completionCopy(source: ConnectedSource): string {
  if (source.type === "meetingNotes") {
    return "Connected. 3 meeting notes are already waiting in your inbox below.";
  }
  return "Connected. Nothing new yet, checks hourly.";
}

interface ConnectSourceDialogProps {
  source: ConnectedSource;
  children: ReactNode;
}

/**
 * The simulated connection flow every not-connected tool card opens into:
 * what OpenPath will read, what it unlocks, a brief connecting beat, then
 * an honest completion state. Connecting dispatches to the store exactly
 * when the completion state shows, which is what makes Granola's 3 seeded
 * meeting notes "immediately" appear in the inbox below.
 */
export function ConnectSourceDialog({ source, children }: ConnectSourceDialogProps) {
  const { connectSource } = useStore();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const isConnecting = step === TOTAL_STEPS;
  const isSummary = step > TOTAL_STEPS;

  useEffect(() => {
    function resetToFirstStep() {
      if (open) setStep(1);
    }
    resetToFirstStep();
  }, [open]);

  useEffect(() => {
    if (!isConnecting) return;
    const timeout = window.setTimeout(() => {
      connectSource(source.id);
      setStep(TOTAL_STEPS + 1);
    }, CONNECT_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [isConnecting, connectSource, source.id]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isSummary ? `Connect ${source.name}` : `Connect ${source.name} · ${STEP_TITLES[step - 1]}`}
          </DialogTitle>
          {!isSummary ? (
            <DialogDescription>
              Step {step} of {TOTAL_STEPS}
            </DialogDescription>
          ) : (
            <DialogDescription>Simulated for this prototype, nothing here reaches a real account.</DialogDescription>
          )}
        </DialogHeader>

        <div className="flex min-h-32 flex-col justify-center gap-3 text-sm">
          {step === 1 ? <p className="text-foreground">{source.readsDescription}</p> : null}
          {step === 2 ? <p className="text-foreground">{source.unlocksDescription}</p> : null}
          {isConnecting ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              <p className="text-xs">Connecting to {source.name}...</p>
            </div>
          ) : null}
          {isSummary ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <Check className="size-5 text-emerald-600 dark:text-emerald-400" />
              <p className="text-foreground">{completionCopy(source)}</p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          {step > 1 && !isConnecting && !isSummary ? (
            <Button variant="outline" onClick={() => setStep((current) => current - 1)}>
              <ArrowLeft className="size-3.5" />
              Back
            </Button>
          ) : (
            <span />
          )}
          {isSummary ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : isConnecting ? (
            <Button disabled>Connecting...</Button>
          ) : (
            <Button onClick={() => setStep((current) => current + 1)}>
              Next
              <ArrowRight className="size-3.5" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
