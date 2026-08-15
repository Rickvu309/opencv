"use client";

// A document kind holds many versions, a CV for Data Analyst, another for BA,
// an English one, with exactly one primary: the version the Coach reads.
//
// The form is inline rather than a modal: it's the same editing contract as the
// rest of the profile, and a modal would hide the list you're adding to.

import * as React from "react";
import Link from "next/link";

import { CoachBox } from "@/components/brand/coach-box";
import {
  Link2,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field } from "./editable";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProfileDocument } from "@/lib/profile/types";
import type { VaultItem } from "@/lib/profile/vault";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

/** Link-backed kinds sync from a URL; file-backed kinds carry an upload. */
const LINK_KINDS = new Set(["linkedin", "github"]);

type Draft = {
  label: string;
  purpose: string;
  targetRole: string;
  language: "vi" | "en";
  url: string;
  fileName: string;
  note: string;
  makePrimary: boolean;
};

const emptyDraft: Draft = {
  label: "",
  purpose: "",
  targetRole: "",
  language: "en",
  url: "",
  fileName: "",
  note: "",
  makePrimary: false,
};

export function DocumentPanel({
  item,
  documents,
  onAdd,
  onUpdate,
  onRemove,
  onSetPrimary,
  onSync,
}: {
  item: VaultItem;
  documents: ProfileDocument[];
  onAdd: (draft: Draft) => void;
  onUpdate: (id: string, draft: Draft) => void;
  onRemove: (id: string) => void;
  onSetPrimary: (id: string) => void;
  onSync: (id: string) => void;
}) {
  const { t, m } = useT();
  const title = item.title;
  const isLink = LINK_KINDS.has(item.id);
  const isEmpty = documents.length === 0;
  const buildsHere = item.id === "cv" || item.id === "cover-letter";
  // CV and letters have a builder elsewhere. Other empty kinds open as the form.
  const opensAsForm = isEmpty && !buildsHere;
  const [mode, setMode] = React.useState<"list" | "add" | string>(
    opensAsForm ? "add" : "list",
  );
  const [draft, setDraft] = React.useState<Draft>(() =>
    opensAsForm
      ? {
          ...emptyDraft,
          label: `${title}, `,
          language: "en",
          makePrimary: true,
        }
      : emptyDraft,
  );
  const [error, setError] = React.useState<string | null>(null);

  const editing = mode !== "list";
  const editingDoc = documents.find((d) => d.id === mode);

  function startAdd() {
    setDraft({
      ...emptyDraft,
      label: `${title}, `,
      language: "en",
      makePrimary: documents.length === 0,
    });
    setError(null);
    setMode("add");
  }

  function startEdit(d: ProfileDocument) {
    setDraft({
      label: d.label,
      purpose: d.purpose ?? "",
      targetRole: d.targetRole ?? "",
      language: d.language,
      url: d.url ?? "",
      fileName: d.fileName ?? "",
      note: d.note ?? "",
      makePrimary: d.isPrimary,
    });
    setError(null);
    setMode(d.id);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.label.trim()) {
      return setError(t(m.profile.docFormNeedLabel));
    }
    if (isLink && !draft.url.trim()) {
      return setError(t(m.profile.docFormNeedUrl));
    }
    if (!isLink && !draft.fileName.trim() && !draft.url.trim()) {
      return setError(t(m.profile.docFormNeedSource));
    }
    if (editingDoc) onUpdate(editingDoc.id, draft);
    else onAdd(draft);
    setMode("list");
    setError(null);
  }

  return (
    <section aria-labelledby="doc-title">
      <div className="flex min-h-14 shrink-0 items-start justify-between gap-3 border-b px-6 py-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-2">
            <h2
              id="doc-title"
              className="text-base font-semibold tracking-tight text-pretty"
            >
              {title}
            </h2>
            {documents.length > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {t(m.profile.versionCount(documents.length))}
              </span>
            )}
          </div>
          {isEmpty && (
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground text-pretty">
              {item.benefit}
            </p>
          )}
        </div>
        {!editing && documents.length > 0 && (
          <Button variant="ghost" size="sm" className="shrink-0" onClick={startAdd}>
            <Plus className="size-3.5" />
            {t(m.profile.docAddVersion)}
          </Button>
        )}
      </div>

      <div className="max-w-2xl px-6 pt-6 pb-5">
        {editing ? (
          <DocumentForm
            item={item}
            isLink={isLink}
            draft={draft}
            setDraft={setDraft}
            error={error}
            isEdit={!!editingDoc}
            hideCancel={isEmpty}
            onSubmit={submit}
            onCancel={() => {
              if (isEmpty) {
                startAdd();
                return;
              }
              setMode("list");
              setError(null);
            }}
          />
        ) : documents.length === 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {/* CV and cover letters can be built in-app; uploading is the
                alternative. Other kinds live outside OpenPath. */}
            {item.id === "cv" && (
              <Button asChild size="sm">
                <Link href="/paper">
                  <Sparkles className="size-3.5" />
                  {t(m.profile.docBuildCv)}
                </Link>
              </Button>
            )}
            {item.id === "cover-letter" && (
              <Button asChild size="sm">
                <Link href="/paper">
                  <Sparkles className="size-3.5" />
                  {t(m.profile.docBuildLetter)}
                </Link>
              </Button>
            )}
            <Button
              size="sm"
              variant={buildsHere ? "outline" : "default"}
              onClick={startAdd}
            >
              <Plus className="size-3.5" />
              {item.id === "cv"
                ? t(m.profile.docUploadExisting)
                : item.id === "cover-letter"
                  ? t(m.profile.docAddFile)
                  : item.addLabel}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <ul className="space-y-2">
              {documents.map((d) => (
                <DocumentRow
                  key={d.id}
                  doc={d}
                  isLink={isLink}
                  onEdit={() => startEdit(d)}
                  onRemove={() => onRemove(d.id)}
                  onSetPrimary={() => onSetPrimary(d.id)}
                  onSync={() => onSync(d.id)}
                />
              ))}
            </ul>

            {/* No standing note here any more: what used to sit above this
                button was a fixed observation about one seeded CV, shown to
                everyone regardless of what they had uploaded. The offer to
                look is honest; the verdict has to come from a real read. */}
            <Button asChild variant="outline" size="sm">
              <Link href={`/coach?q=${encodeURIComponent(item.coachPrompt)}`}>
                <CoachBox size="sm" />
                {t(m.profile.docAskCoach)}
              </Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function DocumentRow({
  doc,
  isLink,
  onEdit,
  onRemove,
  onSetPrimary,
  onSync,
}: {
  doc: ProfileDocument;
  isLink: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onSetPrimary: () => void;
  onSync: () => void;
}) {
  const { t, m } = useT();
  return (
    // Outer radius 12 with 12px padding, so the inner controls sit at 8.
    <li
      className={cn(
        "group/doc rounded-xl border bg-card p-3 transition-shadow hover:shadow-md motion-reduce:transition-none",
        doc.isPrimary && "ring-1 ring-foreground/15",
      )}
    >
      <div className="flex items-start gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onSetPrimary}
              aria-pressed={doc.isPrimary}
              aria-label={t(
                doc.isPrimary
                  ? m.profile.docIsPrimary(doc.label)
                  : m.profile.docMakePrimary(doc.label),
              )}
              className="relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
            >
              {/* Both icons stay mounted and cross-fade: outline is the
                  default state, fill marks active. */}
              <Star
                aria-hidden
                className={cn(
                  "absolute size-4 transition-[opacity,scale,filter] duration-[var(--duration-surface)] ease-snap motion-reduce:transition-none",
                  doc.isPrimary
                    ? "scale-100 opacity-0 blur-none"
                    : "scale-100 text-muted-foreground opacity-100",
                )}
              />
              <Star
                aria-hidden
                fill="currentColor"
                className={cn(
                  "absolute size-4 transition-[opacity,scale,filter] duration-[var(--duration-surface)] ease-snap motion-reduce:transition-none",
                  doc.isPrimary
                    ? "scale-100 opacity-100 blur-none"
                    : "scale-[0.25] opacity-0 blur-[4px]",
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {t(doc.isPrimary ? m.profile.docPrimaryHint : m.profile.docSetPrimary)}
          </TooltipContent>
        </Tooltip>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-medium">{doc.label}</p>
            {doc.isPrimary && (
              <Badge variant="secondary" className="font-normal">
                {t(m.profile.docPrimary)}
              </Badge>
            )}
            {doc.language === "en" && (
              <Badge variant="outline" className="font-normal text-muted-foreground">
                EN
              </Badge>
            )}
          </div>

          {doc.purpose && (
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground text-pretty">
              {doc.purpose}
            </p>
          )}

          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            {doc.fileName ? (
              <Paperclip aria-hidden className="size-3" />
            ) : (
              <Link2 aria-hidden className="size-3" />
            )}
            {/* `||` not `??`: the form stores "" for unused fields. */}
            <span className="truncate">{doc.fileName || doc.url}</span>
            <span aria-hidden>·</span>
            <span>{t(m.profile.docUpdatedAt(doc.updatedAt))}</span>
            {isLink && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {doc.syncedAt
                    ? t(m.profile.docSyncedAt(doc.syncedAt))
                    : t(m.profile.docNeverSynced)}
                </span>
              </>
            )}
          </p>
        </div>

        {/* Actions stay visible on touch; they only fade in on pointer hover. */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity focus-within:opacity-100 group-hover/doc:opacity-100 motion-reduce:transition-none sm:opacity-60">
          {isLink && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onSync}
                  aria-label={t(m.profile.docSync(doc.label))}
                  className="text-muted-foreground"
                >
                  <RefreshCw />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t(m.profile.docResync)}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onEdit}
                aria-label={t(m.profile.docEdit(doc.label))}
                className="text-muted-foreground"
              >
                <Pencil />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t(m.common.edit)}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onRemove}
                aria-label={t(m.profile.docRemove(doc.label))}
                className="text-muted-foreground"
              >
                <Trash2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t(m.common.delete)}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </li>
  );
}

function DocumentForm({
  item,
  isLink,
  draft,
  setDraft,
  error,
  isEdit,
  hideCancel,
  onSubmit,
  onCancel,
}: {
  item: VaultItem;
  isLink: boolean;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  error: string | null;
  isEdit: boolean;
  hideCancel?: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  const { t, m } = useT();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      className="space-y-5"
    >
      <Field
        id="doc-label"
        label={t(m.profile.docFormLabel)}
        autoFocus
        value={draft.label}
        placeholder={`${item.title}, Data Analyst`}
        invalid={Boolean(error) && !draft.label.trim()}
        hint={t(m.profile.docFormLabelHint)}
        onChange={(v) => set("label", v)}
      />

      <Field
        id="doc-purpose"
        label={t(m.profile.docFormPurpose)}
        value={draft.purpose}
        placeholder={t(m.profile.docFormPurposePlaceholder)}
        onChange={(v) => set("purpose", v)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="doc-role"
          label={t(m.profile.docFormRole)}
          value={draft.targetRole}
          placeholder="Data Analyst"
          onChange={(v) => set("targetRole", v)}
        />
      </div>

      {/* The source field differs by kind: links sync, files are uploaded. */}
      {isLink ? (
        <Field
          id="doc-url"
          label={t(m.profile.docFormUrl)}
          type="url"
          value={draft.url}
          placeholder="https://linkedin.com/in/tenban"
          invalid={Boolean(error) && !draft.url.trim()}
          hint={t(m.profile.docFormUrlHint)}
          onChange={(v) => set("url", v)}
        />
      ) : (
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="doc-file">{t(m.profile.docFormFile)}</Label>
            <Input
              id="doc-file"
              value={draft.fileName}
              placeholder={t(m.onboarding.cvFileNamePlaceholder)}
              onChange={(e) => set("fileName", e.target.value)}
            />
          </div>
          <Field
            id="doc-url-alt"
            label={t(m.profile.docFormUrlAlt)}
            type="url"
            value={draft.url}
            placeholder="https://drive.google.com/…"
            onChange={(v) => set("url", v)}
          />
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="doc-note">{t(m.profile.docFormNote)}</Label>
        <Textarea
          id="doc-note"
          className="min-h-16"
          value={draft.note}
          placeholder={t(m.profile.docFormNotePlaceholder)}
          onChange={(e) => set("note", e.target.value)}
        />
      </div>

      <label className="flex items-start gap-2.5 rounded-lg border p-3">
        <input
          type="checkbox"
          checked={draft.makePrimary}
          onChange={(e) => set("makePrimary", e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium">
            {t(m.profile.docFormMakePrimary)}
          </span>
          <span className="block text-xs leading-relaxed text-muted-foreground">
            {t(m.profile.docFormMakePrimaryHint)}
          </span>
        </span>
      </label>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm">
          {t(isEdit ? m.profile.docFormSave : m.profile.docFormAdd)}
        </Button>
        {!hideCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {t(m.common.cancel)}
          </Button>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
