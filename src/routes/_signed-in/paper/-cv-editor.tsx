"use client";

import { QuietCoachOffer } from "@/components/coach/quiet-offer";
import { CvPrintPortal } from "@/components/paper/cv-preview";
import { Button } from "@/components/ui/button";
import { useDispatch } from "@/lib/actions/store";
import type { CvPaper } from "@/lib/paper/types";
import { useT } from "@/lib/i18n/use-t";
import { CvCanvas } from "./-cv-canvas";

export function CvEditor({
  cv,
  fromUpload,
  onFormat,
}: {
  cv: CvPaper;
  fromUpload?: boolean;
  onBack: () => void;
  onFormat: () => void;
}) {
  const dispatch = useDispatch();
  const { t, m } = useT();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex justify-start gap-4 p-4 md:gap-6 md:p-6">
          <div className="min-w-0 flex-1">
            {fromUpload && (
              <p className="mb-3 text-pretty text-sm text-muted-foreground">
                {t(m.paper.uploadStartHint)}
              </p>
            )}
            <CvCanvas cv={cv} />
          </div>
          <aside className="hidden w-52 shrink-0 space-y-3 pt-1 md:block">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={onFormat}
            >
              {t(m.paper.cv.whereGoing)}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={cv.theme.density === "tight" ? "secondary" : "ghost"}
              aria-pressed={cv.theme.density === "tight"}
              className="w-full justify-start"
              onClick={() =>
                dispatch(
                  "paper.setTheme",
                  {
                    id: cv.id,
                    density: cv.theme.density === "tight" ? "normal" : "tight",
                  },
                  { silent: true },
                )
              }
            >
              {t(m.paper.cv.fitOnePage)}
            </Button>
            <QuietCoachOffer
              label={t(m.paper.cv.askCoachHelp)}
              prompt={t(m.paper.cv.askCoachPrompt(cv.label))}
            />
          </aside>
        </div>
      </div>
      <CvPrintPortal cv={cv} />
    </div>
  );
}
