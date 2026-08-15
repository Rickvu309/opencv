"use client";

import { FilePlus2, Plus } from "lucide-react";

import { DraftInput, DraftTextarea } from "@/components/paper/draft-field";
import { CvPrintPortal } from "@/components/paper/cv-preview";
import { Button } from "@/components/ui/button";
import { useDispatch } from "@/lib/actions/store";
import { isProseKind } from "@/lib/paper/cv";
import type { CvPaper, LetterType, LetterPaper } from "@/lib/paper/types";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";
import {
  AddSectionMenu,
  DownloadButton,
  EditorMainBar,
  FormatBar,
  type EditorMode,
} from "./workspace-parts";

export function CvEditor({
  resume,
  resumes,
  papers,
  onSelect,
  onCreateResume,
  onCreatePaper,
  onMode,
  onBack,
}: {
  resume: CvPaper;
  resumes: CvPaper[];
  papers: LetterPaper[];
  onSelect: (id: string) => void;
  onCreateResume: (fromProfile: boolean) => void;
  onCreatePaper: (kind: LetterType) => void;
  onMode: (mode: EditorMode) => void;
  onBack: () => void;
}) {
  const dispatch = useDispatch();
  const { t, m } = useT();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <EditorMainBar
        mode="cv"
        currentId={resume.id}
        currentLabel={resume.label}
        nameLabel={t(m.paper.cv.cvName)}
        onRename={(label) =>
          dispatch("paper.rename", { id: resume.id, label }, { silent: true })
        }
        onDelete={() => dispatch("paper.remove", { id: resume.id })}
        deleteLabel={t(m.paper.cv.deleteCv)}
        resumes={resumes}
        papers={papers}
        onSelect={onSelect}
        onCreateResume={onCreateResume}
        onCreatePaper={onCreatePaper}
        onMode={onMode}
        onBack={onBack}
        trailing={
          <>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => onCreateResume(true)}
            >
              <FilePlus2 className="size-3.5" />
              <span className="hidden sm:inline">{t(m.paper.cv.buildFromProfile)}</span>
            </Button>
            <DownloadButton hint={t(m.paper.cv.exportPdfHint)} />
          </>
        }
      />
      <FormatBar resume={resume} />
      <OnePageEditor resume={resume} />
      <CvPrintPortal resume={resume} />
    </div>
  );
}

const ghostField =
  "[&_input]:h-auto [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-0 [&_input]:shadow-none [&_input]:focus-visible:ring-0";

/** The CV page is the editor. No form beside a preview. */
function OnePageEditor({ resume }: { resume: CvPaper }) {
  const dispatch = useDispatch();
  const { t, m } = useT();
  const { header } = resume;
  const setHeader = (fields: Record<string, unknown>) =>
    dispatch("paper.setHeader", { id: resume.id, ...fields }, { silent: true });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-muted/40">
      <div className="mx-auto max-w-[52rem] px-4 py-6">
        <article className="min-h-[1123px] bg-white px-12 py-10 text-neutral-900 shadow-md ring-1 ring-black/10">
          <DraftInput
            id="page-name"
            label={t(m.paper.cv.headerName)}
            srLabel
            value={header.name}
            placeholder={t(m.paper.cv.headerName)}
            onCommit={(name) => setHeader({ name })}
            className={cn(ghostField, "[&_input]:text-3xl [&_input]:font-semibold")}
          />
          <DraftInput
            id="page-headline"
            label={t(m.paper.cv.headerHeadline)}
            srLabel
            value={header.headline}
            placeholder={t(m.paper.cv.headerHeadlinePlaceholder)}
            onCommit={(headline) => setHeader({ headline })}
            className={cn(
              ghostField,
              "mt-1 [&_input]:text-base [&_input]:text-neutral-600",
            )}
          />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600">
            <DraftInput
              id="page-email"
              label={t(m.paper.cv.headerEmail)}
              srLabel
              value={header.email}
              placeholder={t(m.paper.cv.headerEmail)}
              onCommit={(email) => setHeader({ email })}
              className={cn(ghostField, "w-auto min-w-40")}
            />
            <DraftInput
              id="page-phone"
              label={t(m.paper.cv.headerPhone)}
              srLabel
              value={header.phone}
              placeholder={t(m.paper.cv.headerPhone)}
              onCommit={(phone) => setHeader({ phone })}
              className={cn(ghostField, "w-auto min-w-32")}
            />
            <DraftInput
              id="page-location"
              label={t(m.paper.cv.headerLocation)}
              srLabel
              value={header.location}
              placeholder={t(m.paper.cv.headerLocationPlaceholder)}
              onCommit={(location) => setHeader({ location })}
              className={cn(ghostField, "w-auto min-w-32")}
            />
          </div>

          {resume.sections.map((section) => (
            <PageSection
              key={section.id}
              resumeId={resume.id}
              section={section}
            />
          ))}

          <div className="mt-8">
            <AddSectionMenu resume={resume} />
          </div>
        </article>
      </div>
    </div>
  );
}

function PageSection({
  resumeId,
  section,
}: {
  resumeId: string;
  section: CvPaper["sections"][number];
}) {
  const dispatch = useDispatch();
  const { t, m } = useT();
  const update = (fields: Record<string, unknown>) =>
    dispatch(
      "paper.updateSection",
      { id: resumeId, sectionId: section.id, ...fields },
      { silent: true },
    );

  return (
    <section className="mt-8">
      <DraftInput
        id={`page-h-${section.id}`}
        label={t(m.paper.cv.sectionName)}
        srLabel
        value={section.heading}
        onCommit={(heading) => heading && update({ heading })}
        className={cn(
          ghostField,
          "border-b border-neutral-300 pb-1 [&_input]:text-xs [&_input]:font-semibold [&_input]:tracking-wide [&_input]:uppercase",
        )}
      />
      {isProseKind(section.kind) ? (
        <div className="mt-2 [&_label]:sr-only [&_textarea]:min-h-24 [&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:px-0 [&_textarea]:shadow-none [&_textarea]:focus-visible:ring-0">
          <DraftTextarea
            id={`page-b-${section.id}`}
            label={section.heading}
            value={section.body ?? ""}
            onCommit={(body) => update({ body })}
            rows={4}
          />
        </div>
      ) : (
        <div className="mt-2 space-y-4">
          {section.entries.map((entry) => (
            <div key={entry.id}>
              <DraftInput
                id={`page-t-${entry.id}`}
                label={t(m.paper.cv.entryTitle)}
                srLabel
                value={entry.title}
                placeholder={t(m.paper.cv.entryTitle)}
                onCommit={(title) =>
                  dispatch(
                    "paper.updateEntry",
                    {
                      id: resumeId,
                      sectionId: section.id,
                      entryId: entry.id,
                      title,
                    },
                    { silent: true },
                  )
                }
                className={cn(ghostField, "[&_input]:font-medium")}
              />
              <div className="flex flex-wrap gap-x-3">
                <DraftInput
                  id={`page-o-${entry.id}`}
                  label={t(m.paper.cv.entryOrg)}
                  srLabel
                  value={entry.org ?? ""}
                  placeholder={t(m.paper.cv.entryOrg)}
                  onCommit={(org) =>
                    dispatch(
                      "paper.updateEntry",
                      {
                        id: resumeId,
                        sectionId: section.id,
                        entryId: entry.id,
                        org,
                      },
                      { silent: true },
                    )
                  }
                  className={cn(ghostField, "min-w-40 flex-1 [&_input]:text-sm")}
                />
                <DraftInput
                  id={`page-p-${entry.id}`}
                  label={t(m.paper.cv.entryPeriod)}
                  srLabel
                  value={entry.period ?? ""}
                  placeholder={t(m.paper.cv.entryPeriod)}
                  onCommit={(period) =>
                    dispatch(
                      "paper.updateEntry",
                      {
                        id: resumeId,
                        sectionId: section.id,
                        entryId: entry.id,
                        period,
                      },
                      { silent: true },
                    )
                  }
                  className={cn(ghostField, "w-36 [&_input]:text-sm")}
                />
              </div>
              <div className="[&_label]:sr-only [&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:px-0 [&_textarea]:text-sm [&_textarea]:shadow-none [&_textarea]:focus-visible:ring-0">
                <DraftTextarea
                  id={`page-d-${entry.id}`}
                  label={t(m.paper.cv.entryDetail)}
                  value={entry.detail ?? ""}
                  onCommit={(detail) =>
                    dispatch(
                      "paper.updateEntry",
                      {
                        id: resumeId,
                        sectionId: section.id,
                        entryId: entry.id,
                        detail,
                      },
                      { silent: true },
                    )
                  }
                  rows={3}
                />
              </div>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() =>
              dispatch(
                "paper.addEntry",
                { id: resumeId, sectionId: section.id, title: "" },
                { silent: true },
              )
            }
          >
            <Plus className="size-3.5" />
            {t(m.paper.cv.addEntry)}
          </Button>
        </div>
      )}
    </section>
  );
}
