"use client";

// The editing contract, in one place.
//
// Every editable thing in the profile, identity, context, experience,
// education, each document, follows the same rules: open a draft, validate on
// save, commit or discard, Esc cancels. Those rules were implemented twice and
// were already drifting. This module owns them.
//
// An empty section is the form. `isEmpty` opens the editor on mount and keeps
// it open after Huỷ/`Esc` (those only reset the draft). Edit is for filled
// sections: view, then edit, then save or discard.
//
// Interface: useEditable(...) → { editing, draft, set, start, cancel, save,
// error, keyHandler }, plus <EditableSection> for the chrome and <Field> for a
// labelled input. Callers supply a value, a validator, and a commit function;
// everything else is behind the seam.

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export type Editable<T> = {
  editing: boolean;
  draft: T;
  /** Merge a partial into the draft. */
  set: (patch: Partial<T>) => void;
  /** Replace the draft wholesale, for list edits that rebuild the value. */
  replace: (next: T) => void;
  /** Open the editor from the committed value, or from `seed` instead. */
  start: (seed?: T) => void;
  cancel: () => void;
  /** Validate, then commit. No-op when invalid; sets `error` instead. */
  save: () => void;
  error: string | null;
  /** Spread onto the form/section so Esc cancels from anywhere inside. */
  keyHandler: (e: React.KeyboardEvent) => void;
};

export function useEditable<T>({
  value,
  validate,
  onSave,
  isEmpty = false,
  prepareDraft,
}: {
  value: T;
  /** Return a message to block the save, or null to allow it. */
  validate?: (draft: T) => string | null;
  onSave: (draft: T) => void;
  /** Empty sections open as the form, not as a blank preview. */
  isEmpty?: boolean;
  /** Shape the draft on open (default context rows, a first experience). */
  prepareDraft?: (value: T) => T;
}): Editable<T> {
  const toDraft = React.useCallback(
    (v: T) => (prepareDraft ? prepareDraft(v) : v),
    [prepareDraft],
  );
  const [editing, setEditing] = React.useState(isEmpty);
  const [draft, setDraft] = React.useState<T>(() => toDraft(value));
  const [error, setError] = React.useState<string | null>(null);

  // `seed` replaces the value rather than merging into it. A merge was spelled
  // `{ ...value, ...seed }`, which is meaningless when T is a list: spreading
  // two arrays into an object literal yields `{0: …, 1: …}`, and the next
  // render called `.map` on it. Every caller already passes a whole value.
  const start = React.useCallback(
    (seed?: T) => {
      setDraft(seed ?? toDraft(value));
      setError(null);
      setEditing(true);
    },
    [toDraft, value],
  );

  const cancel = React.useCallback(() => {
    setDraft(toDraft(value));
    setError(null);
    if (!isEmpty) setEditing(false);
  }, [isEmpty, toDraft, value]);

  const save = React.useCallback(() => {
    const message = validate?.(draft) ?? null;
    if (message) {
      setError(message);
      return;
    }
    onSave(draft);
    setEditing(false);
    setError(null);
  }, [draft, onSave, validate]);

  const set = React.useCallback(
    (patch: Partial<T>) => setDraft((d) => ({ ...d, ...patch })),
    [],
  );

  const keyHandler = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && editing) {
        e.stopPropagation();
        cancel();
      }
    },
    [cancel, editing],
  );

  return {
    editing: editing || isEmpty,
    draft,
    set,
    replace: setDraft,
    start,
    cancel,
    save,
    error,
    keyHandler,
  };
}

/**
 * Section chrome: title and one-line hint grouped in the header, the body,
 * and, while editing, a sticky commit bar carrying the error.
 *
 * Edit is hidden while the section is empty because the body already is the
 * form. Huỷ is hidden then too: there is no preview to return to.
 */
export function EditableSection<T>({
  title,
  titleId = "panel-title",
  hint,
  meta,
  editable,
  isEmpty = false,
  saveLabel,
  headerAction,
  children,
}: {
  title: string;
  titleId?: string;
  hint?: string;
  meta?: React.ReactNode;
  editable: Editable<T>;
  isEmpty?: boolean;
  /** Defaults to the shared "Save changes" label. */
  saveLabel?: string;
  /** Replaces the default "Chỉnh sửa" button when a section needs its own. */
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t, m } = useT();
  return (
    <section aria-labelledby={titleId} onKeyDown={editable.keyHandler}>
      <div className="flex min-h-14 shrink-0 items-start justify-between gap-3 border-b px-6 py-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-2">
            <h2
              id={titleId}
              className="text-base font-semibold tracking-tight text-pretty"
            >
              {title}
            </h2>
            {meta}
          </div>
          {hint && (
            <p className="mt-1.5 max-w-2xl text-sm text-pretty text-foreground">
              {hint}
            </p>
          )}
        </div>
        {!editable.editing &&
          (headerAction ?? (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => editable.start()}
            >
              <Pencil className="size-3.5" />
              {t(m.common.edit)}
            </Button>
          ))}
      </div>

      {editable.editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            editable.save();
          }}
        >
          <div className="px-6 pt-6 pb-5">
            <div className="max-w-2xl">{children}</div>
          </div>
          <div className="sticky bottom-0 border-t bg-card px-6 py-3">
            <div className="flex max-w-2xl flex-wrap items-center gap-2">
              <Button type="submit" size="sm">
                {saveLabel ?? t(m.common.save)}
              </Button>
              {!isEmpty && (
                <Button type="button" variant="ghost" size="sm" onClick={editable.cancel}>
                  {t(m.common.cancel)}
                </Button>
              )}
              {editable.error && (
                <p role="alert" className="text-sm text-danger">
                  {editable.error}
                </p>
              )}
            </div>
          </div>
        </form>
      ) : (
        <div className="px-6 pt-6 pb-5">
          <div className="max-w-2xl">{children}</div>
        </div>
      )}
    </section>
  );
}

/**
 * A labelled input. The label is always visible; the placeholder only ever
 * shows the expected format. Hidden behind the interface: the label/control
 * association and the aria-invalid + aria-describedby wiring.
 */
export function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  invalid,
  type,
  autoFocus,
  autoComplete,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Guidance shown under the field, before any mistake. */
  hint?: string;
  invalid?: boolean;
  type?: "text" | "url";
  autoFocus?: boolean;
  autoComplete?: string;
  className?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        inputMode={type === "url" ? "url" : undefined}
        autoComplete={autoComplete}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={hintId}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Read-only label/value row, the resting state of most sections. */
export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-xs text-muted-foreground sm:pt-0.5">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}
