"use client";

import Link from "next/link";

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
import { findSuggestedAction } from "@/lib/opportunity-utils";
import { useStore } from "@/lib/store";
import type { Opportunity } from "@/lib/types";

interface MoveToActiveDialogProps {
  opportunity: Opportunity | null;
  onClose: () => void;
}

/**
 * The named confirmation moving between modes requires (section 2): moving
 * to Active means accepting the opportunity's suggested next action, the
 * same bar isActiveOpportunity checks. Mirrors
 * RecruiterAdvanceStageDialog's confirm-before-commit shape. When there's
 * no suggested next action to accept (the one seeded opportunity Copilot
 * hasn't read yet), the dialog says so honestly instead of offering a
 * button that would silently do nothing, and hands off to the Actions tab
 * instead.
 */
export function MoveToActiveDialog({ opportunity, onClose }: MoveToActiveDialogProps) {
  const { state, moveOpportunityToActive } = useStore();
  const open = opportunity !== null;
  const suggested = opportunity ? findSuggestedAction(opportunity.id, state.nextActions) : undefined;

  function handleConfirm() {
    if (!opportunity) return;
    moveOpportunityToActive(opportunity);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      {/*
        A Dialog portals its DOM node to document.body, but React still
        bubbles the click through the *component* tree, and this dialog is
        rendered by OpportunityQuickActionsMenu, itself a child of the
        board card's own outer Link. Without stopping it here, confirming
        this dialog also bubbles into the Link and navigates to the
        opportunity's detail page, the exact reason
        DropdownMenuContent carries the same stopPropagation.
      */}
      <DialogContent className="max-w-sm" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Move to Active?</DialogTitle>
          <DialogDescription>
            {opportunity && suggested ? (
              <>
                This accepts the suggested next action on {opportunity.role} at {opportunity.company}:{" "}
                {suggested.verb.toLowerCase()}. It joins your active pipeline immediately.
              </>
            ) : opportunity ? (
              <>
                {opportunity.role} at {opportunity.company} has no suggested next action yet, so there is nothing to
                accept. Add one on its Actions tab first, then it can move to Active.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          {suggested ? (
            <Button onClick={handleConfirm}>Move to Active</Button>
          ) : opportunity ? (
            <Button asChild>
              <Link href={`/opportunities/${opportunity.id}#actions`} onClick={onClose}>
                Open Actions tab
              </Link>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
