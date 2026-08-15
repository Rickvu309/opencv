"use client";

import * as React from "react";
import { Download, FileDown, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ParagraphEditor } from "@/components/paper/paragraph-editor";
import { QuietCoachOffer } from "@/components/coach/quiet-offer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useDispatch, useTouched } from "@/lib/actions/store";
import { download } from "@/lib/paper/cv-export";
import { fileStem, toMarkdown, toPlainText } from "@/lib/paper/letter-export";
import { isEmptyLetter } from "@/lib/paper/letter";
import { paperTypeLabels, type LetterPaper } from "@/lib/paper/types";
import type { Opening } from "@/lib/search/types";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export function PaperSheet({
  paper,
  opening,
}: {
  paper: LetterPaper;
  opening: Opening | undefined;
}) {
  const { t, m } = useT();
  const dispatch = useDispatch();
  const touched = useTouched();
  const empty = isEmptyLetter(paper);
  const meta = opening
    ? [opening.title, opening.org].filter(Boolean).join(" · ")
    : paper.targetRole?.trim() || t(paperTypeLabels[paper.type]);

  const ask = paper.targetRole?.trim()
    ? m.paper.letter.askCoachLetterFor(paper.targetRole.trim())
    : m.paper.letter.askCoachLetter;

  const request = [t(ask), paper.label.trim() && `(${paper.label.trim()})`]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="p-6">
      <article
        className={cn(
          "mx-auto max-w-[40rem] overflow-hidden bg-card shadow-md ring-1 ring-black/10",
          touched.includes(paper.id) && "animate-just-changed",
        )}
      >
        <header className="border-b border-border px-5 py-4">
          <TextField
            value={paper.label}
            placeholder={t(m.paper.letter.labelPlaceholder)}
            ariaLabel={t(m.paper.letter.labelField)}
            onCommit={(label) =>
              label && dispatch("paper.rename", { id: paper.id, label }, { silent: true })
            }
          />
          <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            <div className="flex items-center gap-1">
              <QuietCoachOffer
                label={t(empty ? m.paper.letter.askCoach : m.paper.letter.askCoachHelp)}
                prompt={request}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t(m.common.delete)}
                className="text-muted-foreground"
                onClick={() => dispatch("paper.remove", { id: paper.id })}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        </header>

        <ParagraphEditor paper={paper} />
      </article>
    </div>
  );
}

function TextField({
  value,
  placeholder,
  ariaLabel,
  onCommit,
}: {
  value: string;
  placeholder: string;
  ariaLabel: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = React.useState(value);
  const [given, setGiven] = React.useState(value);
  if (value !== given) {
    setGiven(value);
    setDraft(value);
  }

  return (
    <Input
      value={draft}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => draft.trim() !== value && onCommit(draft.trim())}
      className="h-8 min-w-0 border-0 bg-transparent px-0 text-base font-medium shadow-none focus-visible:ring-2 focus-visible:ring-ring/50 md:text-sm"
    />
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
