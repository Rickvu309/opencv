"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import type { RecruiterCandidate, RecruiterStage } from "@/lib/types";

interface RecruiterAdvanceStageDialogProps {
  candidate: RecruiterCandidate | null;
  targetStage: RecruiterStage | null;
  onClose: () => void;
}

/**
 * The confirmation the brief requires before a stage move lands: names the
 * candidate, the exact from-to move, and what it touches (the board and the
 * candidate's own stage history), the same confirm-before-commit pattern
 * DeleteCvDialog already establishes for a destructive action, applied here
 * to a state-changing one instead.
 */
export function RecruiterAdvanceStageDialog({ candidate, targetStage, onClose }: RecruiterAdvanceStageDialogProps) {
  const { advanceRecruiterCandidateStage } = useStore();
  const open = candidate !== null && targetStage !== null;

  function handleConfirm() {
    if (!candidate || !targetStage) return;
    advanceRecruiterCandidateStage(candidate, targetStage);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Move to {targetStage}?</DialogTitle>
          <DialogDescription>
            {candidate && targetStage ? (
              <>
                {candidate.name} moves from {candidate.stage} to {targetStage}. This updates the pipeline board and
                adds an entry to their stage history.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleConfirm}>Move to {targetStage}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
