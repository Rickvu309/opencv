import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getPaperFn } from "@/features/paper/queries";
import { getProfileFn } from "@/features/profile/queries";
import {
  completenessCopy,
  paperContentSchema,
  profileLinesOnPage,
  type CvSection,
  type PaperContent,
} from "@/features/paper/model";
import { FormatBar } from "@/features/paper/components/format-bar";
import { SituationGallery } from "@/features/paper/components/gallery";
import { PaperPage } from "@/features/paper/components/page";
import { runCommand } from "@/ui/run-command";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import { Band } from "@/ui/band";
import { NotFoundState } from "@/ui/empty-state";
import { SkeletonBlock } from "@/ui/skeleton";

function BackLink() {
  return (
    <Link to="/paper" className="inline-flex min-h-11 items-center text-[14px] text-muted-foreground">
      Back
    </Link>
  );
}

export function PaperEditorScreen({ paperId }: { paperId: string }) {
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
  const [exportError, setExportError] = useState(false);

  useEffect(() => {
    if (q.data?.content) {
      setContent(paperContentSchema.parse(q.data.content));
    }
  }, [q.data]);

  if (q.isPending) {
    return (
      <div>
        <div data-print-hide className="print:hidden">
          <Band title="Paper" back={<BackLink />} />
        </div>
        <div className="bg-muted -mx-6 px-6 py-8">
          <SkeletonBlock className="mx-auto h-[80vh] max-w-[210mm]" />
        </div>
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

  function save(next?: PaperContent) {
    const value = next ?? contentRef.current;
    if (!value) return;
    contentRef.current = value;
    setContent(value);
    void runCommand("paper.updateBlock", { id: paperId, content: value });
  }

  function onDensity(density: "normal" | "tight") {
    const next = { ...page, density };
    contentRef.current = next;
    setContent(next);
    void runCommand("paper.setTheme", { id: paperId, density });
  }

  function onSection(section: CvSection, hidden: boolean) {
    const next = { ...page, hidden: { ...page.hidden, [section]: hidden } };
    contentRef.current = next;
    setContent(next);
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
      <div data-print-hide className="sticky top-0 z-20 bg-background print:hidden">
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
        />
        {!letterNeedsSituation ? (
          <FormatBar
            content={page}
            completeness={completeness || undefined}
            showSections={paper.kind === "cv"}
            onDensity={onDensity}
            onSection={onSection}
          />
        ) : null}
        {exportError ? (
          <p className="pb-3 text-[14px] text-destructive">
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
            const next = { ...page, situation };
            save(next);
          }}
        />
      ) : (
        <div className="bg-muted -mx-6 px-6 py-8 print:bg-white print:mx-0 print:px-0 print:py-0">
          <PaperPage kind={String(paper.kind)} content={page} onChange={patch} onSave={save} />
        </div>
      )}
    </div>
  );
}
