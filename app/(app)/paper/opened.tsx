"use client";

import { useAppState, useDispatch } from "@/lib/actions/store";
import { cvCompleteness, wordForTemplate } from "@/lib/paper/cv";
import { openingForPaper } from "@/lib/paper/opening";
import {
  isCvPaper,
  isLetterPaper,
  isProofPaper,
  type Paper,
} from "@/lib/paper/types";
import { useT } from "@/lib/i18n/use-t";
import { CvEditor } from "./cv-editor";
import { LetterEditor } from "./letter-editor";
import { ProofEditor } from "./proof-editor";
import { DownloadButton, EditorMainBar } from "./workspace-parts";
import { PaperExportMenu } from "@/components/paper/sheet";
import { Button } from "@/components/ui/button";

export function OpenedBand({
  paper,
  arranging,
  onBack,
  onFormat,
  onArrange,
}: {
  paper: Paper;
  arranging?: boolean;
  onBack: () => void;
  onFormat: () => void;
  onArrange?: () => void;
}) {
  const dispatch = useDispatch();
  const { t, m } = useT();

  if (isCvPaper(paper)) {
    return (
      <EditorMainBar
        currentId={paper.id}
        currentLabel={paper.label}
        nameLabel={t(m.paper.cv.cvName)}
        typeLabel={wordForTemplate(paper.theme.template)}
        onRename={(label) =>
          dispatch("paper.rename", { id: paper.id, label }, { silent: true })
        }
        onDelete={() => dispatch("paper.remove", { id: paper.id })}
        deleteLabel={t(m.paper.cv.deleteCv)}
        onBack={onBack}
        meta={
          <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
            {t(m.paper.cv.readyPercent(cvCompleteness(paper)))}
          </span>
        }
        trailing={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="md:hidden"
              onClick={onFormat}
            >
              {t(m.paper.cv.whereGoing)}
            </Button>
            <DownloadButton hint={t(m.paper.cv.exportPdfHint)} />
          </>
        }
      />
    );
  }

  if (isLetterPaper(paper)) {
    return (
      <EditorMainBar
        currentId={paper.id}
        currentLabel={paper.label || t(m.paper.letter.untitled)}
        nameLabel={t(m.paper.letter.labelField)}
        typeLabel={t(m.paper.kindLetter)}
        onRename={(label) =>
          dispatch("paper.rename", { id: paper.id, label }, { silent: true })
        }
        onDelete={() => dispatch("paper.remove", { id: paper.id })}
        deleteLabel={t(m.common.delete)}
        onBack={onBack}
        trailing={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="md:hidden"
              onClick={onFormat}
            >
              {t(m.paper.letterChooserTitle)}
            </Button>
            <PaperExportMenu paper={paper} />
            <DownloadButton hint={t(m.paper.cv.exportPdfHint)} />
          </>
        }
      />
    );
  }

  if (isProofPaper(paper)) {
    return (
      <ProofEditor
        paper={paper}
        onBack={onBack}
        band
        arranging={arranging}
        onArrange={onArrange}
      />
    );
  }

  return null;
}

export function Opened({
  paper,
  fromUpload,
  arranging,
  onBack,
  onFormat,
  onArrange,
}: {
  paper: Paper;
  fromUpload?: boolean;
  arranging?: boolean;
  onBack: () => void;
  onFormat: () => void;
  onArrange?: () => void;
}) {
  const state = useAppState();

  if (isCvPaper(paper)) {
    return (
      <CvEditor
        cv={paper}
        fromUpload={fromUpload}
        onBack={onBack}
        onFormat={onFormat}
      />
    );
  }
  if (isLetterPaper(paper)) {
    return (
      <LetterEditor
        paper={paper}
        opening={openingForPaper(state, paper.id)}
        onBack={onBack}
        onFormat={onFormat}
      />
    );
  }
  if (isProofPaper(paper)) {
    return (
      <ProofEditor
        paper={paper}
        onBack={onBack}
        arranging={arranging}
        onArrange={onArrange}
      />
    );
  }

  return null;
}
