"use client";

import * as React from "react";

import { DraftInput } from "@/components/paper/draft-field";
import { PhotoField } from "@/components/paper/photo-field";
import { SectionEditor } from "@/components/paper/section-editor";
import { CvPreview, CvPrintPortal } from "@/components/paper/cv-preview";
import { Button } from "@/components/ui/button";
import { useDispatch } from "@/lib/actions/store";
import { cvCompleteness, templateHasPhoto, wordForTemplate } from "@/lib/paper/cv";
import type { CvPaper } from "@/lib/paper/types";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";
import {
  AddSectionMenu,
  DownloadButton,
  EditorMainBar,
  FormatBar,
} from "./workspace-parts";

export function CvEditor({
  cv,
  onBack,
}: {
  cv: CvPaper;
  onBack: () => void;
}) {
  const dispatch = useDispatch();
  const { t, m } = useT();
  const [pane, setPane] = React.useState<"edit" | "preview">("edit");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <EditorMainBar
        currentId={cv.id}
        currentLabel={cv.label}
        nameLabel={t(m.paper.cv.cvName)}
        typeLabel={wordForTemplate(cv.theme.template)}
        onRename={(label) =>
          dispatch("paper.rename", { id: cv.id, label }, { silent: true })
        }
        onDelete={() => dispatch("paper.remove", { id: cv.id })}
        deleteLabel={t(m.paper.cv.deleteCv)}
        onBack={onBack}
        trailing={<DownloadButton hint={t(m.paper.cv.exportPdfHint)} />}
      />
      <FormatBar cv={cv} />
      <div
        role="group"
        aria-label={t(m.paper.cv.paneSwitch)}
        className="flex border-b border-border px-3 py-1 md:hidden"
      >
        <Button
          type="button"
          size="sm"
          variant={pane === "edit" ? "secondary" : "ghost"}
          className="h-7"
          onClick={() => setPane("edit")}
        >
          {t(m.paper.cv.editPane)}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={pane === "preview" ? "secondary" : "ghost"}
          className="h-7"
          onClick={() => setPane("preview")}
        >
          {t(m.paper.cv.previewPane)}
        </Button>
      </div>
      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]">
        <div
          className={cn(
            "min-h-0 overflow-y-auto border-e border-border",
            pane === "preview" && "hidden md:block",
          )}
        >
          <CvForm cv={cv} />
        </div>
        <div
          className={cn(
            "min-h-0 overflow-y-auto bg-muted/40 p-4",
            pane === "edit" && "hidden md:block",
          )}
        >
          <CvPreview cv={cv} />
        </div>
      </div>
      <CvPrintPortal cv={cv} />
    </div>
  );
}

function CvForm({ cv }: { cv: CvPaper }) {
  const dispatch = useDispatch();
  const { t, m } = useT();
  const completeness = cvCompleteness(cv);
  const setHeader = (fields: Record<string, unknown>) =>
    dispatch("paper.setHeader", { id: cv.id, ...fields }, { silent: true });

  return (
    <div className="space-y-6 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p
          aria-label={t(m.paper.cv.completeness)}
          className="text-xs text-muted-foreground tabular-nums"
        >
          {completeness}%
        </p>
      </div>

      {templateHasPhoto(cv.theme.template) && <PhotoField cv={cv} />}

      <div className="space-y-3">
        <DraftInput
          id="form-name"
          label={t(m.paper.cv.headerName)}
          value={cv.header.name}
          onCommit={(name) => setHeader({ name })}
        />
        <DraftInput
          id="form-headline"
          label={t(m.paper.cv.headerHeadline)}
          value={cv.header.headline}
          placeholder={t(m.paper.cv.headerHeadlinePlaceholder)}
          onCommit={(headline) => setHeader({ headline })}
        />
        <DraftInput
          id="form-email"
          label={t(m.paper.cv.headerEmail)}
          value={cv.header.email}
          onCommit={(email) => setHeader({ email })}
        />
        <DraftInput
          id="form-phone"
          label={t(m.paper.cv.headerPhone)}
          value={cv.header.phone}
          onCommit={(phone) => setHeader({ phone })}
        />
        <DraftInput
          id="form-location"
          label={t(m.paper.cv.headerLocation)}
          value={cv.header.location}
          placeholder={t(m.paper.cv.headerLocationPlaceholder)}
          onCommit={(location) => setHeader({ location })}
        />
      </div>

      {cv.sections.map((section, index) => (
        <SectionEditor
          key={section.id}
          paperId={cv.id}
          section={section}
          isFirst={index === 0}
          isLast={index === cv.sections.length - 1}
        />
      ))}

      <AddSectionMenu cv={cv} />
    </div>
  );
}
