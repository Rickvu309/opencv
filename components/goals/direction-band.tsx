"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DirectionAlignment } from "@/lib/opportunity-utils";
import { useStore } from "@/lib/store";
import type { Profile } from "@/lib/types";

interface DirectionBandProps {
  profile: Profile;
  alignment: DirectionAlignment;
}

/**
 * The top band on /goals: the editable target direction statement and time
 * horizon, plus the alignment summary line computed from seed opportunity
 * data. Editing here is the same target direction shown on Profile and Home,
 * so a change lands everywhere at once.
 */
export function DirectionBand({ profile, alignment }: DirectionBandProps) {
  const { updateTargetDirection } = useStore();
  const [editing, setEditing] = useState(false);
  const [statementDraft, setStatementDraft] = useState(profile.targetDirection);
  const [horizonDraft, setHorizonDraft] = useState(profile.targetDirectionHorizon);

  function startEditing() {
    setStatementDraft(profile.targetDirection);
    setHorizonDraft(profile.targetDirectionHorizon);
    setEditing(true);
  }

  function save() {
    const trimmedStatement = statementDraft.trim();
    const trimmedHorizon = horizonDraft.trim();
    if (!trimmedStatement || !trimmedHorizon) return;
    updateTargetDirection({ targetDirection: trimmedStatement, targetDirectionHorizon: trimmedHorizon });
    setEditing(false);
  }

  return (
    <Card className="rounded-none border-x-0 border-t-0 ring-0">
      <CardContent className="flex flex-col gap-3">
        {editing ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="direction-statement">Target direction</Label>
              <Textarea
                id="direction-statement"
                rows={2}
                value={statementDraft}
                onChange={(event) => setStatementDraft(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="direction-horizon">Time horizon</Label>
              <Input
                id="direction-horizon"
                value={horizonDraft}
                placeholder="For example, Next 12 to 18 months"
                onChange={(event) => setHorizonDraft(event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={save}
                disabled={!statementDraft.trim() || !horizonDraft.trim()}
              >
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-base font-medium text-foreground">{profile.targetDirection}</p>
              <p className="text-xs text-muted-foreground">Time horizon: {profile.targetDirectionHorizon}</p>
            </div>
            <Button size="sm" variant="outline" onClick={startEditing}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          {alignment.aligned} of {alignment.active} active opportunities move toward this direction.
        </p>
      </CardContent>
    </Card>
  );
}
