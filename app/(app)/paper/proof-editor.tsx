"use client";

import * as React from "react";
import { toast } from "sonner";

import { QuietCoachOffer } from "@/components/coach/quiet-offer";
import { DraftInput } from "@/components/paper/draft-field";
import { ProofArticle } from "@/components/paper/proof-article";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAppState, useDispatch } from "@/lib/actions/store";
import { snapshotOf } from "@/lib/paper/share";
import { cvsOf, type ProofNoteKind, type ProofPaper } from "@/lib/paper/types";
import { useT } from "@/lib/i18n/use-t";
import { EditorMainBar } from "./workspace-parts";

export function ProofEditor({
  paper,
  onBack,
  band,
  arranging,
  onArrange,
}: {
  paper: ProofPaper;
  onBack: () => void;
  band?: boolean;
  arranging?: boolean;
  onArrange?: () => void;
}) {
  const state = useAppState();
  const dispatch = useDispatch();
  const { t, m } = useT();
  const [draft, setDraft] = React.useState("");
  const [linkLabel, setLinkLabel] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [adding, setAdding] = React.useState<ProofNoteKind>("note");
  const [noteError, setNoteError] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const noteRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const empty = paper.notes.length === 0;
  const master = cvsOf(state.paper)[0];

  const addToCv = () => {
    if (!master) return;
    const projects =
      master.sections.find((section) => section.kind === "projects") ??
      master.sections[0];
    if (!projects) return;
    const title = paper.label || t(m.paper.proof.untitled);
    const detail = paper.notes
      .map((note) => note.text)
      .filter(Boolean)
      .join("\n");
    dispatch("paper.addEntry", {
      id: master.id,
      sectionId: projects.id,
      title,
      org: paper.role,
      period: paper.dates,
      detail,
    });
  };

  const publish = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/proof-share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paperId: paper.id }),
      });
      if (response.status === 401) {
        toast.error(t(m.paper.proof.signInToPublish));
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { slug?: string };
      dispatch("paper.publishProof", {
        id: paper.id,
        ...(body.slug ? { slug: body.slug } : {}),
      });
    } catch {
      toast.error(t(m.paper.proof.publishFailed));
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/proof-share", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paperId: paper.id }),
      });
      if (response.status === 401) {
        toast.error(t(m.paper.proof.signInToPublish));
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      dispatch("paper.unpublishProof", { id: paper.id });
      toast.success(t(m.paper.proof.unpublished));
    } catch {
      toast.error(t(m.paper.proof.publishFailed));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!paper.published) return;
    const url = `${window.location.origin}/p/${paper.published.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t(m.paper.proof.linkCopied));
    } catch {
      toast.error(t(m.paper.proof.copyFailed));
    }
  };

  if (band) {
    return (
      <EditorMainBar
        currentId={paper.id}
        currentLabel={paper.label || t(m.paper.proof.untitled)}
        nameLabel={t(m.paper.letter.labelField)}
        typeLabel={t(m.paper.kindProof)}
        onRename={(label) =>
          dispatch("paper.rename", { id: paper.id, label }, { silent: true })
        }
        onDelete={() => dispatch("paper.remove", { id: paper.id })}
        deleteLabel={t(m.common.delete)}
        onBack={onBack}
        trailing={
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={arranging ? "secondary" : "outline"}
              aria-pressed={Boolean(arranging)}
              onClick={() => onArrange?.()}
            >
              {t(m.paper.proof.arrange)}
            </Button>
            {paper.published ? (
              <>
                <Button size="sm" variant="outline" onClick={() => void copyLink()}>
                  {t(m.paper.proof.copyLink)}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void unpublish()}
                >
                  {t(m.paper.proof.unpublish)}
                </Button>
              </>
            ) : null}
            <Button size="sm" disabled={busy} onClick={() => void publish()}>
              {busy && <Spinner size="sm" />}
              {t(m.paper.proof.publish)}
            </Button>
          </div>
        }
      />
    );
  }

  const addFile = (file: File, kind: "photo" | "file") => {
    dispatch("paper.addNote", {
      id: paper.id,
      kind,
      text: file.name,
      fileName: file.name,
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto bg-[oklch(0.96_0.008_85)] p-4">
        <div className="mx-auto max-w-xl space-y-6">
          {arranging ? (
            <ArrangeDraft paper={paper} name={state.profile.identity.name} />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <DraftInput
                  id="proof-role"
                  label={t(m.paper.proof.roleField)}
                  value={paper.role ?? ""}
                  onCommit={(role) =>
                    dispatch(
                      "paper.setProofMeta",
                      { id: paper.id, role },
                      { silent: true },
                    )
                  }
                />
                <DraftInput
                  id="proof-dates"
                  label={t(m.paper.proof.datesField)}
                  value={paper.dates ?? ""}
                  onCommit={(dates) =>
                    dispatch(
                      "paper.setProofMeta",
                      { id: paper.id, dates },
                      { silent: true },
                    )
                  }
                />
                <DraftInput
                  id="proof-link"
                  type="url"
                  autoComplete="url"
                  label={t(m.paper.proof.linkField)}
                  value={paper.link ?? ""}
                  onCommit={(link) =>
                    dispatch(
                      "paper.setProofMeta",
                      { id: paper.id, link },
                      { silent: true },
                    )
                  }
                />
              </div>

              {empty ? (
                <div className="rounded-xl border bg-card p-4">
                  <h2 className="text-sm font-semibold">
                    {t(m.paper.proof.emptyTitle)}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(m.paper.proof.emptyBody)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(
                      [
                        [m.paper.proof.chipClass, t(m.paper.proof.chipClass)],
                        [m.paper.proof.chipShift, t(m.paper.proof.chipShift)],
                        [m.paper.proof.chipFailed, t(m.paper.proof.chipFailed)],
                      ] as const
                    ).map(([key, label]) => (
                      <Button
                        key={key}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          dispatch("paper.addNote", { id: paper.id, text: label })
                        }
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["note", t(m.paper.proof.addNote)],
                    ["photo", t(m.paper.proof.addPhoto)],
                    ["file", t(m.paper.proof.addFile)],
                    ["link", t(m.paper.proof.addLink)],
                  ] as const
                ).map(([kind, label]) => (
                  <Button
                    key={kind}
                    type="button"
                    size="sm"
                    variant={adding === kind ? "secondary" : "ghost"}
                    aria-pressed={adding === kind}
                    onClick={() => {
                      setAdding(kind);
                      if (kind === "photo" || kind === "file") {
                        fileRef.current?.click();
                      }
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept={adding === "photo" ? "image/*" : undefined}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  addFile(file, adding === "photo" ? "photo" : "file");
                }}
              />

              {adding === "link" ? (
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!linkUrl.trim()) return;
                    dispatch("paper.addNote", {
                      id: paper.id,
                      kind: "link",
                      text: linkLabel.trim() || linkUrl.trim(),
                      url: linkUrl.trim(),
                    });
                    setLinkLabel("");
                    setLinkUrl("");
                  }}
                >
                  <DraftInput
                    id="proof-link-label"
                    label={t(m.paper.proof.linkLabel)}
                    value={linkLabel}
                    onCommit={setLinkLabel}
                  />
                  <DraftInput
                    id="proof-link-url"
                    type="url"
                    label={t(m.paper.proof.linkUrl)}
                    value={linkUrl}
                    onCommit={setLinkUrl}
                  />
                  <Button type="submit" size="sm">
                    {t(m.paper.proof.addLink)}
                  </Button>
                </form>
              ) : adding === "note" ? (
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const text = draft.trim();
                    if (!text) {
                      setNoteError(true);
                      noteRef.current?.focus();
                      return;
                    }
                    dispatch("paper.addNote", { id: paper.id, text });
                    setDraft("");
                    setNoteError(false);
                  }}
                >
                  <div className="grid gap-1.5">
                    <Label htmlFor="proof-note">{t(m.paper.proof.noteLabel)}</Label>
                    <Textarea
                      ref={noteRef}
                      id="proof-note"
                      name="note"
                      placeholder={t(m.paper.proof.notePlaceholder)}
                      value={draft}
                      aria-invalid={noteError || undefined}
                      onChange={(event) => {
                        setDraft(event.target.value);
                        if (noteError) setNoteError(false);
                      }}
                      rows={4}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" size="sm">
                      {t(m.paper.proof.addNote)}
                    </Button>
                    {master && !empty && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={addToCv}
                      >
                        {t(m.paper.proof.addToCv)}
                      </Button>
                    )}
                  </div>
                </form>
              ) : null}

              <ul className="space-y-3">
                {paper.notes.map((note) => (
                  <li
                    key={note.id}
                    className="rounded-xl border bg-card p-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-[var(--duration-surface)] motion-safe:ease-[var(--ease-enter)]"
                  >
                    <p className="text-xs text-muted-foreground">
                      {note.kind && note.kind !== "note" ? note.kind : null}
                    </p>
                    <p className="whitespace-pre-wrap text-sm">
                      {note.text || note.fileName}
                    </p>
                    {note.url ? (
                      <a
                        href={note.url}
                        className="mt-1 block text-sm underline underline-offset-4"
                      >
                        {note.url}
                      </a>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{note.at}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          dispatch("paper.removeNote", {
                            id: paper.id,
                            noteId: note.id,
                          })
                        }
                      >
                        {t(m.common.delete)}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <QuietCoachOffer
                label={t(m.paper.proof.askCoachHelp)}
                prompt={t(m.paper.letter.askCoachProof)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ArrangeDraft({ paper, name }: { paper: ProofPaper; name?: string }) {
  const dispatch = useDispatch();
  const { t, m } = useT();
  const selected = paper.arrangeNoteIds ?? paper.notes.map((note) => note.id);

  const setIds = (arrangeNoteIds: string[]) =>
    dispatch(
      "paper.setProofMeta",
      { id: paper.id, arrangeNoteIds },
      { silent: true },
    );

  const snapshot = snapshotOf(
    { ...paper, arrangeNoteIds: selected },
    new Date(),
    { name },
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t(m.paper.proof.arrangeLead)}</p>
      <DraftInput
        id={`${paper.id}-why`}
        label={t(m.paper.proof.whyField)}
        value={paper.why ?? ""}
        placeholder={t(m.paper.proof.whyPlaceholder)}
        onCommit={(why) =>
          dispatch("paper.setProofMeta", { id: paper.id, why }, { silent: true })
        }
      />
      <ul className="space-y-2">
        {paper.notes.map((note) => {
          const on = selected.includes(note.id);
          return (
            <li key={note.id}>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={on}
                  onChange={() =>
                    setIds(
                      on
                        ? selected.filter((id) => id !== note.id)
                        : [...selected, note.id],
                    )
                  }
                />
                <span className="min-w-0 whitespace-pre-wrap">
                  {note.text || note.fileName}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="bg-[#f3ebe0]">
        <ProofArticle snapshot={snapshot} />
      </div>
    </div>
  );
}
