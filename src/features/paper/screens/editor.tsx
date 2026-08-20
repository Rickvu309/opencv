import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getPaperFn } from "@/features/paper/queries";
import { getProfileFn } from "@/features/profile/queries";
import {
  applyPaperPatch,
  completenessCopy,
  paperBlockKeys,
  paperContentSchema,
  profileLinesOnPage,
  type CvSection,
  type PaperBlockKey,
  type PaperContent,
} from "@/features/paper/model";
import { FormatBar } from "@/features/paper/components/format-bar";
import { SituationGallery } from "@/features/paper/components/gallery";
import { PaperPage } from "@/features/paper/components/page";
import { useCoachSession } from "@/features/coach/components/session";
import { runCommand } from "@/ui/run-command";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import { Band } from "@/ui/band";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { NotFoundState, QueryError } from "@/ui/empty-state";
import { SkeletonPage } from "@/ui/skeleton";

function BackLink() {
  return (
    <Link to="/paper" className="inline-flex min-h-[var(--size-touch)] items-center text-[13px] text-ink-muted">
      Back
    </Link>
  );
}

export function PaperEditorScreen({ paperId }: { paperId: string }) {
  const navigate = useNavigate();
  const { openDock } = useCoachSession();
  const q = useQuery({
    queryKey: ["paper", paperId],
    queryFn: () => getPaperFn({ data: { id: paperId } }),
  });
  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfileFn(),
    enabled: q.data?.kind === "cv",
  });
  const [content, setContent] = useState<PaperContent | null>(null);
  const contentRef = useRef<PaperContent | null>(null);
  const dirtyRef = useRef(new Set<PaperBlockKey>());
  const pendingRef = useRef<Partial<Record<PaperBlockKey, PaperContent[PaperBlockKey]>>>({});
  const timerRef = useRef<number | null>(null);
  const chainRef = useRef(Promise.resolve());
  const [exportError, setExportError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!q.data?.content) return;
    const remote = paperContentSchema.parse(q.data.content);
    setContent((local) => {
      if (!local) {
        contentRef.current = remote;
        return remote;
      }
      const patch: Partial<Pick<PaperContent, PaperBlockKey>> = {};
      for (const key of paperBlockKeys) {
        if (dirtyRef.current.has(key)) continue;
        Object.assign(patch, { [key]: remote[key] });
      }
      const next = applyPaperPatch(
        { ...local, density: remote.density, hidden: remote.hidden },
        patch,
      );
      contentRef.current = next;
      return next;
    });
  }, [q.data]);

  if (q.isPending) {
    return (
      <div>
        <div data-print-hide className="print:hidden">
          <Band title="Paper" back={<BackLink />} />
        </div>
        <SkeletonPage />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div>
        <div data-print-hide className="print:hidden">
          <Band title="Paper" back={<BackLink />} />
        </div>
        <QueryError onRetry={() => void q.refetch()} />
      </div>
    );
  }
  if (!q.data) {
    return (
      <div>
        <div data-print-hide className="print:hidden">
          <Band title="Paper" back={<BackLink />} />
        </div>
        <NotFoundState
          title="That paper is not here. Open Paper to see your list."
          href="/paper"
          label="Back to Paper"
        />
      </div>
    );
  }

  const paper = q.data;
  const page = content ?? paperContentSchema.parse(paper.content);
  contentRef.current = page;
  const letterNeedsSituation = paper.kind === "letter" && !page.situation;
  const lines =
    paper.kind === "cv" && profileQ.data
      ? profileLinesOnPage(profileQ.data.profile, page)
      : null;
  const completeness = lines ? completenessCopy(lines.onPage, lines.total) : "";

  function patch(next: PaperContent) {
    contentRef.current = next;
    setContent(next);
  }

  function persist(key: PaperBlockKey, value: PaperContent[PaperBlockKey]) {
    dirtyRef.current.add(key);
    chainRef.current = chainRef.current
      .then(async () => {
        await runCommand("paper.updateBlock", { id: paperId, [key]: value });
        const latest = contentRef.current?.[key];
        if (JSON.stringify(latest) === JSON.stringify(value)) {
          dirtyRef.current.delete(key);
        }
        setSaveError(false);
      })
      .catch(() => {
        setSaveError(true);
        pendingRef.current[key] = value;
      });
  }

  function flush() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = {};
    for (const key of paperBlockKeys) {
      const value = pending[key];
      if (value === undefined) continue;
      persist(key, value);
    }
  }

  function schedule(key: PaperBlockKey, value: PaperContent[PaperBlockKey]) {
    dirtyRef.current.add(key);
    pendingRef.current[key] = value;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => flush(), 400);
  }

  function onChange(next: PaperContent) {
    const prev = contentRef.current;
    patch(next);
    if (!prev) return;
    for (const key of paperBlockKeys) {
      if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
        schedule(key, next[key]);
      }
    }
  }

  function onCommit(key: PaperBlockKey, value: PaperContent[PaperBlockKey]) {
    const next = applyPaperPatch(contentRef.current ?? page, { [key]: value });
    patch(next);
    pendingRef.current[key] = undefined;
    persist(key, value);
  }

  function retrySave() {
    const latest = contentRef.current;
    if (!latest) return;
    for (const key of dirtyRef.current) {
      persist(key, latest[key]);
    }
  }

  function onDensity(density: "normal" | "tight") {
    const next = { ...page, density };
    patch(next);
    void runCommand("paper.setTheme", { id: paperId, density });
  }

  function onSection(section: CvSection, hidden: boolean) {
    const next = { ...page, hidden: { ...page.hidden, [section]: hidden } };
    patch(next);
    void runCommand("paper.updateSection", { id: paperId, section, hidden });
  }

  function onExport() {
    setExportError(false);
    if (typeof window.print !== "function") {
      setExportError(true);
      return;
    }
    try {
      window.print();
    } catch {
      setExportError(true);
    }
  }

  return (
    <div>
      <div data-print-hide className="sticky top-0 z-[var(--z-sticky)] bg-surface-1 print:hidden">
        <Band
          title={
            <h1 className="min-w-0 flex-1">
              <Input
                aria-label="Title"
                defaultValue={paper.title}
                onBlur={(e) => void runCommand("paper.rename", { id: paperId, title: e.target.value })}
              />
            </h1>
          }
          back={<BackLink />}
          meta={paper.typeWord}
          primary={
            <Button className="shrink-0" onClick={onExport}>
              Export
            </Button>
          }
          secondary={
            paper.kind === "cv" ? (
              <Button variant="ghost" className="shrink-0" onClick={() => setRemoveOpen(true)}>
                Delete
              </Button>
            ) : null
          }
        />
        {!letterNeedsSituation ? (
          <FormatBar
            content={page}
            completeness={completeness || undefined}
            showSections={paper.kind === "cv"}
            onDensity={onDensity}
            onSection={onSection}
            onAskCoach={paper.kind === "cv" ? () => openDock() : undefined}
          />
        ) : null}
        {saveError ? (
          <p className="pb-3 text-[13px] text-destructive">
            Couldn't save. Try again.
            <Button variant="ghost" className="ml-2" onClick={retrySave}>
              Try again
            </Button>
          </p>
        ) : null}
        {exportError ? (
          <p className="pb-3 text-[13px] text-destructive">
            Couldn't export. Try again.
            <Button variant="ghost" className="ml-2" onClick={onExport}>
              Try again
            </Button>
          </p>
        ) : null}
      </div>

      {letterNeedsSituation ? (
        <SituationGallery
          kind="letter"
          onPick={(situation) => {
            onCommit("situation", situation);
          }}
        />
      ) : (
        <div className="-mx-5 bg-surface-2 px-5 py-8 print:mx-0 print:bg-white print:px-0 print:py-0">
          <PaperPage
            kind={String(paper.kind)}
            content={page}
            publishedLines={paper.publishedLines ?? []}
            onChange={onChange}
            onCommit={onCommit}
          />
        </div>
      )}

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`Delete this ${paper.typeWord}?`}
        body="This removes the document. It cannot be undone."
        confirmLabel={`Delete ${paper.typeWord}`}
        onConfirm={() => {
          void runCommand("paper.remove", { id: paperId }).then(() =>
            navigate({ to: "/paper" }),
          );
        }}
      />
    </div>
  );
}
