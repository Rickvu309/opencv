"use client";

import { PaperPrintPortal } from "@/components/paper/paper-print";
import { PaperExportMenu, PaperSheet } from "@/components/paper/sheet";
import { useDispatch } from "@/lib/actions/store";
import type { CvPaper, LetterPaper, LetterType } from "@/lib/paper/types";
import type { Opening } from "@/lib/search/types";
import { useT } from "@/lib/i18n/use-t";
import {
  DownloadButton,
  EditorMainBar,
  type ArtefactRef,
  type EditorMode,
} from "./workspace-parts";

export function PaperEditor({
  paper,
  resumes,
  papers,
  opening,
  onSelect,
  onCreateResume,
  onCreatePaper,
  onMode,
  onBack,
}: {
  paper: LetterPaper;
  resumes: CvPaper[];
  papers: LetterPaper[];
  opening: Opening | undefined;
  onSelect: (ref: ArtefactRef) => void;
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
        mode="paper"
        currentId={paper.id}
        currentLabel={paper.label || t(m.papers.untitled)}
        nameLabel={t(m.papers.labelField)}
        onRename={(label) =>
          dispatch("paper.rename", { id: paper.id, label }, { silent: true })
        }
        onDelete={() => dispatch("paper.remove", { id: paper.id })}
        deleteLabel={t(m.common.delete)}
        resumes={resumes}
        papers={papers}
        onSelect={onSelect}
        onCreateResume={onCreateResume}
        onCreatePaper={onCreatePaper}
        onMode={onMode}
        onBack={onBack}
        trailing={
          <>
            <PaperExportMenu paper={paper} />
            <DownloadButton hint={t(m.cv.exportPdfHint)} />
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/40">
        <PaperSheet paper={paper} opening={opening} />
      </div>
      <PaperPrintPortal paper={paper} />
    </div>
  );
}
