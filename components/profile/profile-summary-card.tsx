"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";

/**
 * Professional summary, the first thing Copilot reads when judging fit.
 * Inline edit and save states, no dedicated dialog, since this is a single
 * short field.
 */
export function ProfileSummaryCard() {
  const { state, updateProfileSummary } = useStore();
  const { summary } = state.profile;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary);

  function startEditing() {
    setDraft(summary);
    setEditing(true);
  }

  function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    updateProfileSummary(trimmed);
    setEditing(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary</CardTitle>
        {editing ? null : (
          <CardAction>
            <Button size="icon-sm" variant="ghost" aria-label="Edit summary" onClick={startEditing}>
              <Pencil className="size-3.5" />
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {editing ? (
          <>
            <Textarea
              rows={4}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="3 to 4 sentences on who you are and what you're moving toward"
            />
            <div className="flex gap-1.5">
              <Button size="sm" disabled={!draft.trim()} onClick={handleSave}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-foreground">{summary}</p>
        )}
      </CardContent>
    </Card>
  );
}
