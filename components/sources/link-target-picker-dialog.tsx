"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { evidenceTitle } from "@/lib/inbox-utils";
import { useStore } from "@/lib/store";
import type { InboxLinkChoice, SourceEvidence, SourceEvidenceMapsToType } from "@/lib/types";

interface LinkTargetPickerDialogProps {
  evidence: SourceEvidence;
  children: ReactNode;
}

function initialObjectId(evidence: SourceEvidence): string {
  return evidence.mapsToType === "trackRecord" ? "" : evidence.mapsToId;
}

/**
 * The picker behind an inbox item's "Choose different" action: pick another
 * object type, then the specific opportunity or goal. Track record never
 * picks an existing object, linking that way always drafts a fresh
 * candidate, so there's nothing to select once that type is chosen.
 */
export function LinkTargetPickerDialog({ evidence, children }: LinkTargetPickerDialogProps) {
  const { state, linkInboxItem } = useStore();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<SourceEvidenceMapsToType>(evidence.mapsToType);
  const [objectId, setObjectId] = useState<string>(initialObjectId(evidence));

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setType(evidence.mapsToType);
      setObjectId(initialObjectId(evidence));
    }
  }

  function handleTypeChange(value: string) {
    if (!value) return;
    const nextType = value as SourceEvidenceMapsToType;
    setType(nextType);
    if (nextType === "opportunity") setObjectId(state.opportunities[0]?.id ?? "");
    else if (nextType === "goal") setObjectId(state.goals[0]?.id ?? "");
    else setObjectId("");
  }

  function handleConfirm() {
    let choice: InboxLinkChoice;
    if (type === "trackRecord") {
      choice = { type: "trackRecord" };
    } else if (type === "opportunity") {
      const target = state.opportunities.find((opportunity) => opportunity.id === objectId);
      if (!target) return;
      choice = { type: "opportunity", id: target.id, label: target.company };
    } else {
      const target = state.goals.find((goal) => goal.id === objectId);
      if (!target) return;
      choice = { type: "goal", id: target.id, label: target.title };
    }
    linkInboxItem(evidence, choice);
    setOpen(false);
  }

  const canConfirm = type === "trackRecord" || Boolean(objectId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link {evidenceTitle(evidence)}</DialogTitle>
          <DialogDescription>Choose what this belongs to. Nothing is linked until you confirm.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <ToggleGroup type="single" variant="outline" value={type} onValueChange={handleTypeChange} className="w-full">
            <ToggleGroupItem value="opportunity" className="flex-1">
              Opportunity
            </ToggleGroupItem>
            <ToggleGroupItem value="goal" className="flex-1">
              Goal
            </ToggleGroupItem>
            <ToggleGroupItem value="trackRecord" className="flex-1">
              Track record
            </ToggleGroupItem>
          </ToggleGroup>

          {type === "opportunity" ? (
            <Select value={objectId} onValueChange={setObjectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose an opportunity" />
              </SelectTrigger>
              <SelectContent>
                {state.opportunities.map((opportunity) => (
                  <SelectItem key={opportunity.id} value={opportunity.id}>
                    {opportunity.role} at {opportunity.company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {type === "goal" ? (
            <Select value={objectId} onValueChange={setObjectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a goal" />
              </SelectTrigger>
              <SelectContent>
                {state.goals.map((goal) => (
                  <SelectItem key={goal.id} value={goal.id}>
                    {goal.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {type === "trackRecord" ? (
            <p className="text-xs text-muted-foreground">
              Creates a new candidate in Track Record&apos;s review inbox, with this item kept as its evidence.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            <Link2 className="size-3.5" />
            Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
