"use client";

import { PaperPrintPortal } from "@/components/paper/paper-print";
import { PaperSheet } from "@/components/paper/sheet";
import { Button } from "@/components/ui/button";
import type { LetterPaper } from "@/lib/paper/types";
import type { Opening } from "@/lib/search/types";
import { useT } from "@/lib/i18n/use-t";

export function LetterEditor({
  paper,
  opening,
  onFormat,
}: {
  paper: LetterPaper;
  opening: Opening | undefined;
  onFormat: () => void;
}) {
  const { t, m } = useT();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex justify-start gap-4 p-4 md:p-6">
          <div className="min-w-0 flex-1">
            <PaperSheet paper={paper} opening={opening} />
          </div>
          <aside className="hidden w-52 shrink-0 pt-1 md:block">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={onFormat}
            >
              {t(m.paper.letterChooserTitle)}
            </Button>
          </aside>
        </div>
      </div>
      <PaperPrintPortal paper={paper} />
    </div>
  );
}
