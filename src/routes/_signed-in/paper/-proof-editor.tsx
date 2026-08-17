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
import { usePublishProof, useUnpublishProof } from "@/lib/query/satellite";
import { EditorMainBar } from "./-workspace-parts";

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
  const publishProof = usePublishProof();
  const unpublishProof = useUnpublishProof();
  const [draft, setDraft] = React.useState("");
  const [linkLabel, setLinkLabel] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [adding, setAdding] = React.useState<ProofNoteKind>("note");
  const [noteError, setNoteError] = React.useState(false);
  const [skipChips, setSkipChips] = React.useState(false);
  const busy = publishProof.isPending || unpublishProof.isPending;
  const noteRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const fileKindRef = React.useRef<"photo" | "file">("file");
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
    try {
      const result = await publishProof.mutateAsync(paper.id);
      if (result.unauthorized) {
        toast.error(t(m.paper.proof.signInToPublish));
        return;
      }
      dispatch("paper.publishProof", {
        id: paper.id,
        ...(result.slug ? { slug: result.slug } : {}),
      });
    } catch {
      toast.error(t(m.paper.proof.publishFailed));
    }
  };

  const unpublish = async () => {
    try {
      const result = await unpublishProof.mutateAsync(paper.id);
      if (result.unauthorized) {
        toast.error(t(m.paper.proof.signInToPublish));
        return;
      }
      dispatch("paper.unpublishProof", { id: paper.id });
      toast.success(t(m.paper.proof.unpublished));
    } catch {
      toast.error(t(m.paper.proof.publishFailed));
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

  const lineClass =
    "gap-0 min-w-[7rem] flex-1 [&_input]:h-7 [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-0 [&_input]:shadow-none [&_input]:placeholder:text-muted-foreground";

  const pickFile = (kind: "photo" | "file") => {
    fileKindRef.current = kind;
    const input = fileRef.current;
    if (!input) return;
    input.accept = kind === "photo" ? "image/*" : "";
    input.setAttribute(
      "aria-label",
      kind === "photo" ? t(m.paper.proof.addPhoto) : t(m.paper.proof.addFile),
    );
    input.click();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-xl">
          {arranging ? (
            <ArrangeDraft paper={paper} name={state.profile.identity.name} />
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end gap-x-2 border-b border-border pb-3">
                <DraftInput
                  id={`${paper.id}-role`}
                  label={t(m.paper.proof.roleField)}
                  srLabel
                  value={paper.role ?? ""}
                  placeholder={t(m.paper.proof.roleField)}
                  onCommit={(role) =>
                    dispatch(
                      "paper.setProofMeta",
                      { id: paper.id, role },
                      { silent: true },
                    )
                  }
                  className={lineClass}
                />
                <span aria-hidden className="pb-1.5 text-muted-foreground">
                  ·
                </span>
                <DraftInput
                  id={`${paper.id}-dates`}
                  label={t(m.paper.proof.datesField)}
                  srLabel
                  value={paper.dates ?? ""}
                  placeholder={t(m.paper.proof.datesField)}
                  onCommit={(dates) =>
                    dispatch(
                      "paper.setProofMeta",
                      { id: paper.id, dates },
                      { silent: true },
                    )
                  }
                  className={lineClass}
                />
                <span aria-hidden className="pb-1.5 text-muted-foreground">
                  ·
                </span>
                <DraftInput
                  id={`${paper.id}-link`}
                  type="url"
                  autoComplete="url"
                  label={t(m.paper.proof.linkField)}
                  srLabel
                  value={paper.link ?? ""}
                  placeholder={t(m.paper.proof.linkField)}
                  onCommit={(link) =>
                    dispatch(
                      "paper.setProofMeta",
                      { id: paper.id, link },
                      { silent: true },
                    )
                  }
                  className={lineClass}
                />
              </div>

              {empty && !skipChips ? (
                <div>
                  <p className="text-pretty text-sm text-muted-foreground">
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
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSkipChips(true);
                        setAdding("note");
                        noteRef.current?.focus();
                      }}
                    >
                      {t(m.paper.proof.chipNone)}
                    </Button>
                  </div>
                </div>
              ) : null}

              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (adding === "link") {
                    if (!linkUrl.trim()) return;
                    dispatch("paper.addNote", {
                      id: paper.id,
                      kind: "link",
                      text: linkLabel.trim() || linkUrl.trim(),
                      url: linkUrl.trim(),
                    });
                    setLinkLabel("");
                    setLinkUrl("");
                    setAdding("note");
                    return;
                  }
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
                {adding === "link" ? (
                  <div className="space-y-1">
                    <DraftInput
                      id={`${paper.id}-link-label`}
                      label={t(m.paper.proof.linkLabel)}
                      srLabel
                      value={linkLabel}
                      placeholder={t(m.paper.proof.linkLabel)}
                      onCommit={setLinkLabel}
                      className={lineClass}
                    />
                    <DraftInput
                      id={`${paper.id}-link-url`}
                      type="url"
                      label={t(m.paper.proof.linkUrl)}
                      srLabel
                      value={linkUrl}
                      placeholder={t(m.paper.proof.linkUrl)}
                      onCommit={setLinkUrl}
                      className={lineClass}
                    />
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="proof-note" className="sr-only">
                      {t(m.paper.proof.noteLabel)}
                    </Label>
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
                      rows={3}
                      className="min-h-[4.5rem] resize-none border-0 bg-transparent px-0 shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
                    />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1">
                  <Button type="submit" size="sm">
                    {adding === "link"
                      ? t(m.paper.proof.addLink)
                      : t(m.paper.proof.addNote)}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => pickFile("photo")}
                  >
                    {t(m.paper.proof.addPhoto)}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => pickFile("file")}
                  >
                    {t(m.paper.proof.addFile)}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={adding === "link" ? "secondary" : "ghost"}
                    aria-pressed={adding === "link"}
                    onClick={() =>
                      setAdding((kind) => (kind === "link" ? "note" : "link"))
                    }
                  >
                    {t(m.paper.proof.addLink)}
                  </Button>
                </div>
              </form>
              <input
                ref={fileRef}
                type="file"
                className="sr-only"
                aria-label={t(m.paper.proof.addFile)}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  addFile(file, fileKindRef.current);
                }}
              />

              <ul>
                {paper.notes.map((note) => (
                  <li
                    key={note.id}
                    className="border-t border-border py-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-[var(--duration-surface)] motion-safe:ease-[var(--ease-enter)]"
                  >
                    <p className="whitespace-pre-wrap text-sm text-pretty">
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
                      <span className="text-xs text-muted-foreground">
                        {note.at}
                      </span>
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

              {master && !empty ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={addToCv}
                >
                  {t(m.paper.proof.addToCv)}
                </Button>
              ) : null}
              <QuietCoachOffer
                label={t(m.paper.proof.askCoachHelp)}
                prompt={t(m.paper.letter.askCoachProof)}
              />
            </div>
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
