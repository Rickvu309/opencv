"use client";

import * as React from "react";
import { toast } from "sonner";

import { QuietCoachOffer } from "@/components/coach/quiet-offer";
import { DraftInput } from "@/components/paper/draft-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppState, useDispatch } from "@/lib/actions/store";
import { cvsOf, type ProofPaper } from "@/lib/paper/types";
import { useT } from "@/lib/i18n/use-t";
import { EditorMainBar } from "./workspace-parts";

export function ProofEditor({
  paper,
  onBack,
}: {
  paper: ProofPaper;
  onBack: () => void;
}) {
  const state = useAppState();
  const dispatch = useDispatch();
  const { t, m } = useT();
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const empty = paper.notes.length === 0;
  const master = cvsOf(state.paper)[0];

  const suggest = () => {
    const experience = state.profile.experience[0];
    const school = state.profile.education.school;
    const text = experience
      ? `${experience.title} at ${experience.org}`
      : school
        ? school
        : t(m.paper.proof.suggestFromProfile);
    dispatch("paper.addNote", { id: paper.id, text });
  };

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

  return (
    <div className="flex h-full min-h-0 flex-col">
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
            <QuietCoachOffer
              label={t(m.paper.proof.prepare)}
              prompt={t(m.paper.letter.askCoachProof)}
            />
            {paper.published ? (
              <Button size="sm" variant="outline" onClick={() => void copyLink()}>
                {t(m.paper.proof.copyLink)}
              </Button>
            ) : (
              <Button size="sm" disabled={busy} onClick={() => void publish()}>
                {t(m.paper.proof.publish)}
              </Button>
            )}
          </div>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-xl space-y-6">
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
              <h2 className="text-sm font-semibold">{t(m.paper.proof.emptyTitle)}</h2>
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
                <Button type="button" size="sm" variant="ghost" onClick={suggest}>
                  {t(m.paper.proof.chipNone)}
                </Button>
              </div>
            </div>
          ) : null}

          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              const text = draft.trim();
              if (!text) return;
              dispatch("paper.addNote", { id: paper.id, text });
              setDraft("");
            }}
          >
            <Textarea
              id="proof-note"
              aria-label={t(m.paper.proof.notePlaceholder)}
              placeholder={t(m.paper.proof.notePlaceholder)}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={4}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" disabled={!draft.trim()}>
                {t(m.common.add)}
              </Button>
              {master && !empty && (
                <Button type="button" size="sm" variant="ghost" onClick={addToCv}>
                  {t(m.paper.proof.addToCv)}
                </Button>
              )}
            </div>
          </form>

          <ul className="space-y-3">
            {paper.notes.map((note) => (
              <li key={note.id} className="rounded-xl border bg-card p-3">
                <p className="whitespace-pre-wrap text-sm">{note.text}</p>
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
        </div>
      </div>
    </div>
  );
}
