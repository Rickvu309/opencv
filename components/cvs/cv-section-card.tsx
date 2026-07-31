"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import type { CvSection } from "@/lib/types";

/**
 * One structured section card in the CV detail's main column: read view by
 * default, inline editable on demand. Not a document editor, editing stays
 * scoped to one section's text at a time with a save action and feedback
 * toast, matching the other inline-edit surfaces in the app.
 */
export function CvSectionCard({ cvId, section }: { cvId: string; section: CvSection }) {
  const { updateCvSectionContent } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.content);

  function startEditing() {
    setDraft(section.content);
    setEditing(true);
  }

  function handleSave() {
    if (!draft.trim()) return;
    updateCvSectionContent(cvId, section.id, draft.trim());
    setEditing(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{section.title}</CardTitle>
        <CardAction>
          {editing ? null : (
            <Button size="icon-sm" variant="ghost" aria-label={`Edit ${section.title}`} onClick={startEditing}>
              <Pencil className="size-3.5" />
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {editing ? (
          <>
            <Textarea rows={4} value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus />
            <div className="flex justify-end gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X className="size-3.5" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!draft.trim()}>
                <Check className="size-3.5" />
                Save
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{section.content}</p>
        )}
      </CardContent>
    </Card>
  );
}
