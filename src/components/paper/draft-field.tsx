"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * A field that holds a draft while you type and commits when you leave.
 *
 * Committing per keystroke would be simpler, and wrong three ways: every letter
 * would be an undoable action in the toast stack, every letter would serialise
 * the whole state to `localStorage`, and every letter would be a separate edit
 * for the Coach to read mid-word. Committing on blur makes one edit out of one
 * thought, which is also what `useEditable` does everywhere else in the app.
 *
 * The Coach can rewrite the same field from a turn while it is on screen. When
 * that happens the incoming value has to win, so this re-syncs by comparing
 * against the last value it saw, during render. That is React's own answer for
 * derived state, and unlike an effect it does not render the stale value first.
 */
function useDraft(value: string, onCommit: (next: string) => void) {
  const [draft, setDraft] = React.useState(value);
  const [seen, setSeen] = React.useState(value);

  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }

  const commit = React.useCallback(() => {
    const next = draft.trim();
    if (next === value.trim()) return;
    onCommit(next);
  }, [draft, value, onCommit]);

  return { draft, setDraft, commit };
}

export function DraftInput({
  id,
  label,
  value,
  onCommit,
  placeholder,
  className,
  srLabel,
  type = "text",
  autoComplete,
  name,
}: {
  id: string;
  label: string;
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  className?: string;
  /** Keep the label for screen readers only, where the column heading says it. */
  srLabel?: boolean;
  type?: React.HTMLInputTypeAttribute;
  autoComplete?: string;
  name?: string;
}) {
  const { draft, setDraft, commit } = useDraft(value, onCommit);

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className={srLabel ? "sr-only" : undefined}>
        {label}
      </Label>
      <Input
        id={id}
        name={name ?? id}
        type={type}
        autoComplete={autoComplete}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          // Esc puts the committed value back rather than committing a
          // half-typed one, matching the editing contract in the profile.
          if (e.key === "Escape") {
            e.stopPropagation();
            setDraft(value);
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

export function DraftTextarea({
  id,
  label,
  value,
  onCommit,
  placeholder,
  hint,
  rows = 4,
  srLabel,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  hint?: string;
  rows?: number;
  srLabel?: boolean;
  className?: string;
}) {
  const { draft, setDraft, commit } = useDraft(value, onCommit);
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className={srLabel ? "sr-only" : undefined}>
        {label}
      </Label>
      <Textarea
        id={id}
        rows={rows}
        value={draft}
        placeholder={placeholder}
        aria-describedby={hintId}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        // No Enter-to-commit here: Enter is a new bullet.
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            setDraft(value);
            e.currentTarget.blur();
          }
        }}
      />
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
