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
import { findPrimaryNextAction } from "@/lib/opportunity-utils";
import { useStore } from "@/lib/store";
import type { Opportunity } from "@/lib/types";

interface MoveToWatchlistDialogProps {
  opportunity: Opportunity | null;
  onClose: () => void;
}

/**
 * The reverse of MoveToActiveDialog, offered from a Saved opportunity's own
 * quick-actions menu once it's already in the Active lens: un-accepts its
 * accepted next action back to suggested, dropping it back to Watchlist
 * without touching status. Named confirmation, same shape as the forward
 * move.
 */
export function MoveToWatchlistDialog({ opportunity, onClose }: MoveToWatchlistDialogProps) {
  const { state, moveOpportunityToWatchlist } = useStore();
  const open = opportunity !== null;
  const accepted = opportunity ? findPrimaryNextAction(opportunity.id, state.nextActions) : undefined;

  function handleConfirm() {
    if (!opportunity) return;
    moveOpportunityToWatchlist(opportunity);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      {/*
        Stops the click from bubbling through the React component tree into
        this dialog's own ancestor (the board card's outer Link), the same
        portal-bubbling fix MoveToActiveDialog needs and DropdownMenuContent
        already has.
      */}
      <DialogContent className="max-w-sm" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Move to Watchlist?</DialogTitle>
          <DialogDescription>
            {opportunity ? (
              <>
                {opportunity.role} at {opportunity.company} leaves the active pipeline
                {accepted ? <> and its next action, {accepted.verb.toLowerCase()}, goes back to suggested</> : null}.
                Nothing is deleted, it moves to the watchlist until you&apos;re ready to work it.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleConfirm}>Move to Watchlist</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
