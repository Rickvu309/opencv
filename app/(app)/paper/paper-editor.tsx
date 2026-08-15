"use client";

import { PaperPrintPortal } from "@/components/paper/paper-print";
import { PaperExportMenu, PaperSheet } from "@/components/paper/sheet";
import { useDispatch } from "@/lib/actions/store";
import type { LetterPaper } from "@/lib/paper/types";
import type { Opening } from "@/lib/search/types";
import { useT } from "@/lib/i18n/use-t";
import { DownloadButton, EditorMainBar } from "./workspace-parts";

export function PaperEditor({
  paper,
  opening,
  onBack,
}: {
  paper: LetterPaper;
  opening: Opening | undefined;
  onBack: () => void;
}) {
  const dispatch = useDispatch();
  const { t, m } = useT();

  return (
    <div className="flex h-full min-h-0 flex-col">
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
            <PaperExportMenu paper={paper} />
            <DownloadButton hint={t(m.paper.cv.exportPdfHint)} />
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
