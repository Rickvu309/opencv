"use client";

import * as React from "react";
import { Download, FileDown } from "lucide-react";
import { toast } from "sonner";

import { ParagraphEditor } from "@/components/paper/paragraph-editor";
import { DraftInput } from "@/components/paper/draft-field";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDispatch } from "@/lib/actions/store";
import { download } from "@/lib/paper/cv-export";
import { fileStem, toMarkdown, toPlainText } from "@/lib/paper/letter-export";
import { sheetTransitionName } from "@/lib/paper/room";
import type { LetterPaper } from "@/lib/paper/types";
import type { Opening } from "@/lib/search/types";
import { useT } from "@/lib/i18n/use-t";

const lineClass =
  "gap-0 [&_input]:h-7 [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-0 [&_input]:shadow-none [&_input]:placeholder:text-black/25";

export function PaperSheet({
  paper,
  opening,
}: {
  paper: LetterPaper;
  opening: Opening | undefined;
}) {
  const { t, m } = useT();
  const dispatch = useDispatch();
  const speculative = paper.situation === "speculative";
  const role = paper.targetRole ?? opening?.title ?? "";
  const org = paper.org ?? opening?.org ?? "";

  const setMeta = (fields: { org?: string; to?: string; subject?: string; targetRole?: string }) =>
    dispatch("paper.setLetterMeta", { id: paper.id, ...fields }, { silent: true });

  return (
    <div
      className="w-full min-h-[36rem] max-w-[794px] bg-sheet text-black ring-1 ring-black/10"
      style={{ viewTransitionName: sheetTransitionName(paper.id) }}
    >
      <div className="flex h-full flex-col gap-4 px-6 py-7 sm:px-10 sm:py-9">
        {speculative ? (
          <div className="space-y-1 border-b border-black/10 pb-3">
            <DraftInput
              id={`${paper.id}-to`}
              label={t(m.paper.letter.toField)}
              srLabel
              value={paper.to ?? ""}
              placeholder={t(m.paper.letter.toPlaceholder)}
              onCommit={(to) => setMeta({ to })}
              className={lineClass}
            />
            <DraftInput
              id={`${paper.id}-subject`}
              label={t(m.paper.letter.subjectField)}
              srLabel
              value={paper.subject ?? ""}
              placeholder={t(m.paper.letter.subjectPlaceholder)}
              onCommit={(subject) => setMeta({ subject })}
              className={`${lineClass} [&_input]:font-medium`}
            />
          </div>
        ) : (
          <div className="space-y-1">
            <DraftInput
              id={`${paper.id}-role`}
              label={t(m.paper.letter.situationRole)}
              srLabel
              value={role}
              placeholder={t(m.paper.letter.targetRolePlaceholder)}
              onCommit={(targetRole) => setMeta({ targetRole })}
              className={`${lineClass} [&_input]:font-medium`}
            />
            <DraftInput
              id={`${paper.id}-org`}
              label={t(m.paper.letter.situationOrg)}
              srLabel
              value={org}
              placeholder={t(m.paper.letter.situationOrg)}
              onCommit={(next) => setMeta({ org: next })}
              className={`${lineClass} [&_input]:text-black/60`}
            />
          </div>
        )}
        <ParagraphEditor paper={paper} />
      </div>
    </div>
  );
}

export function PaperExportMenu({ paper }: { paper: LetterPaper }) {
  const { t, m } = useT();
  const stem = fileStem(paper);

  const save = (extension: string, contents: string, mime: string) => {
    download(`${stem}.${extension}`, contents, mime);
    toast.success(t(m.paper.cv.downloaded(`${stem}.${extension}`)));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <FileDown className="size-3.5" />
          <span className="hidden sm:inline">{t(m.paper.cv.exportLabel)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-muted-foreground">
          {t(m.paper.cv.exportDownload)}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => save("md", toMarkdown(paper), "text/markdown")}>
          <Download />
          <span className="flex-1">{t(m.paper.cv.exportMarkdown)}</span>
          <span className="text-xs text-muted-foreground">.md</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => save("txt", toPlainText(paper), "text/plain")}>
          <Download />
          <span className="flex-1">{t(m.paper.cv.exportText)}</span>
          <span className="text-xs text-muted-foreground">.txt</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
