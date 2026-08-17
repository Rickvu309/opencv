"use client";

import type { ReactNode } from "react";
import { ArrowLeft, Printer, Trash2 } from "lucide-react";

import { DraftInput } from "@/components/paper/draft-field";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n/use-t";

export function EditorMainBar({
  currentId,
  currentLabel,
  nameLabel,
  typeLabel,
  onRename,
  onDelete,
  deleteLabel,
  onBack,
  trailing,
  meta,
}: {
  currentId: string;
  currentLabel: string;
  nameLabel: string;
  typeLabel: string;
  onRename: (label: string) => void;
  onDelete: () => void;
  deleteLabel: string;
  onBack: () => void;
  trailing: ReactNode;
  meta?: ReactNode;
}) {
  const { t, m } = useT();

  return (
    <>
      <div className="flex min-w-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          aria-label={t(m.paper.backToList)}
          onClick={onBack}
        >
          <ArrowLeft className="size-3.5 rtl:-scale-x-100" />
        </Button>
        <h1 className="sr-only">{currentLabel}</h1>
        <span style={{ viewTransitionName: `paper-name-${currentId}` }}>
          <DraftInput
            id={`doc-name-${currentId}`}
            label={nameLabel}
            srLabel
            value={currentLabel}
            onCommit={(label) => label && onRename(label)}
            className="min-w-0 max-w-[12rem] gap-0 sm:max-w-[14rem] [&_input]:h-7 [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-1.5 [&_input]:text-base [&_input]:font-medium [&_input]:shadow-none sm:[&_input]:text-sm"
          />
        </span>
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {typeLabel}
        </span>
        {meta}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={deleteLabel}
          className="text-muted-foreground"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="flex items-center gap-1">{trailing}</div>
    </>
  );
}

export function DownloadButton({ hint }: { hint: string }) {
  const { t, m } = useT();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          aria-label={t(m.paper.cv.exportPdf)}
          onClick={() => window.print()}
        >
          <Printer className="size-3.5" />
          <span className="hidden sm:inline">{t(m.paper.cv.exportPdf)}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{hint}</TooltipContent>
    </Tooltip>
  );
}
