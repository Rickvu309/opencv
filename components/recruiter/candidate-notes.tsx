"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import type { RecruiterCandidate } from "@/lib/types";

/** Editable notes, the same draft-then-save pattern the candidate-side opportunity Overview tab already uses for its own Notes card. */
export function CandidateNotes({ candidate }: { candidate: RecruiterCandidate }) {
  const { setRecruiterCandidateNotes } = useStore();
  const [draft, setDraft] = useState(candidate.notes ?? "");
  const dirty = draft !== (candidate.notes ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Textarea
          rows={4}
          value={draft}
          placeholder="What's worth remembering about this candidate"
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          className="w-fit"
          disabled={!dirty}
          onClick={() => setRecruiterCandidateNotes(candidate.id, draft)}
        >
          Save note
        </Button>
      </CardContent>
    </Card>
  );
}
