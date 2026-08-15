"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaperToolbar } from "@/components/paper/toolbar";
import { templates, wordForTemplate } from "@/lib/paper/cv";
import {
  letterSituations,
  type CvTemplate,
  type LetterSituation,
} from "@/lib/paper/types";
import { letterSituationLabels } from "@/lib/paper/letter";
import { useT } from "@/lib/i18n/use-t";

export function CvGallery({
  onPick,
  onBack,
}: {
  onPick: (template: CvTemplate) => void;
  onBack: () => void;
}) {
  const { t, m } = useT();
  const labels: Record<CvTemplate, string> = {
    classic: t(m.paper.cv.templateClassic),
    internship: t(m.paper.cv.templateInternship),
    academic: t(m.paper.cv.templateAcademic),
    service: t(m.paper.cv.templateService),
    compact: t(m.paper.cv.templateCompact),
    modern: t(m.paper.cv.templateModern),
    technical: t(m.paper.cv.templateTechnical),
    design: t(m.paper.cv.templateDesign),
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PaperToolbar>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t(m.paper.backToList)}
          onClick={onBack}
        >
          <ArrowLeft className="size-3.5 rtl:-scale-x-100" />
          {t(m.paper.backToList)}
        </Button>
      </PaperToolbar>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <h1 className="text-pretty text-base font-semibold tracking-tight">
          {t(m.paper.galleryTitle)}
        </h1>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((template) => (
            <li key={template}>
              <button
                type="button"
                onClick={() => onPick(template)}
                className="flex h-full w-full flex-col rounded-xl border bg-card p-4 text-start hover:bg-muted/70"
              >
                <span className="text-sm font-medium">{labels[template]}</span>
                <span className="mt-1 text-xs text-muted-foreground">
                  {wordForTemplate(template)}
                </span>
                {template === "design" && (
                  <span className="mt-2 text-xs text-muted-foreground">
                    {t(m.paper.cv.templateDesignHint)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function LetterChooser({
  onPick,
  onBack,
}: {
  onPick: (
    situation: LetterSituation,
    extras: { role?: string; org?: string },
  ) => void;
  onBack: () => void;
}) {
  const { t, m } = useT();
  const [situation, setSituation] = React.useState<LetterSituation | null>(null);
  const [role, setRole] = React.useState("");
  const [org, setOrg] = React.useState("");

  const labels: Record<LetterSituation, string> = {
    posted: t(m.paper.letter.situationPosted),
    internship: t(m.paper.letter.situationInternship),
    speculative: t(m.paper.letter.situationSpeculative),
    scholarship: t(m.paper.letter.situationScholarship),
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PaperToolbar>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t(m.paper.backToList)}
          onClick={() => (situation ? setSituation(null) : onBack())}
        >
          <ArrowLeft className="size-3.5 rtl:-scale-x-100" />
          {t(m.paper.backToList)}
        </Button>
      </PaperToolbar>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <h1 className="text-pretty text-base font-semibold tracking-tight">
          {t(m.paper.letterChooserTitle)}
        </h1>
        {!situation ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {letterSituations.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => setSituation(item)}
                  className="flex h-full w-full flex-col rounded-xl border bg-card p-4 text-start hover:bg-muted/70"
                >
                  <span className="text-sm font-medium">{labels[item]}</span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    {letterSituationLabels[item]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <form
            className="mt-4 max-w-md space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              onPick(situation, {
                role: role.trim() || undefined,
                org: org.trim() || undefined,
              });
            }}
          >
            <p className="text-sm text-muted-foreground">{labels[situation]}</p>
            {(situation === "posted" || situation === "internship") && (
              <div className="grid gap-1.5">
                <Label htmlFor="letter-role">
                  {situation === "internship"
                    ? t(m.paper.letter.situationProgram)
                    : t(m.paper.letter.situationRole)}
                </Label>
                <Input
                  id="letter-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="letter-org">
                {situation === "scholarship"
                  ? t(m.paper.letter.situationAward)
                  : t(m.paper.letter.situationOrg)}
              </Label>
              <Input
                id="letter-org"
                value={org}
                onChange={(event) => setOrg(event.target.value)}
              />
            </div>
            <Button type="submit">{t(m.paper.letter.startLetter)}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
