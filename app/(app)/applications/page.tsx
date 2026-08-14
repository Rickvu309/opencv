"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import Link from "next/link";

import { CoachCat } from "@/components/brand/coach-cat";
import { EmptyState } from "@/components/empty-state";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCoach } from "@/components/coach/provider";
import { useAppState, useDispatch, useTouched } from "@/lib/actions/store";
import {
  FORWARD_STATUSES,
  byUrgency,
  canTransition,
  nextStep,
  type Application,
  type ApplicationStatus,
} from "@/lib/applications/types";
import { useT } from "@/lib/i18n/use-t";
import { paperKindLabels } from "@/lib/papers/types";
import { openingById, type Opening } from "@/lib/search/types";
import { cn } from "@/lib/utils";

/**
 * Where every application stands, and what to do about it this week.
 *
 * The rows are ordered by deadline rather than by when they were added, because
 * the question somebody opens this screen with is "what needs me today", not
 * "what did I do first". Closed applications sink.
 */
export default function ApplicationsPage() {
  const state = useAppState();
  const { t, m } = useT();
  const touched = useTouched();
  const ordered = byUrgency(state.applications);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          {t(m.applications.title)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(m.applications.lead)}
        </p>
      </header>

      {ordered.length === 0 ? (
        <EmptyState
          title={t(m.applications.emptyTitle)}
          body={t(m.applications.emptyBody)}
          action={{ href: "/search", label: t(m.applications.emptyAction) }}
        />
      ) : (
        <div className="mt-6 space-y-3">
          {ordered.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              opening={openingById(state.openings, application.openingId)}
              flash={touched.includes(application.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<ApplicationStatus, "statusInterested" | "statusApplied" | "statusInterviewing" | "statusOffer" | "statusRejected"> = {
  interested: "statusInterested",
  applied: "statusApplied",
  interviewing: "statusInterviewing",
  offer: "statusOffer",
  rejected: "statusRejected",
};

function ApplicationCard({
  application,
  opening,
  flash,
}: {
  application: Application;
  opening: Opening | undefined;
  flash: boolean;
}) {
  const { t, m, locale } = useT();
  const dispatch = useDispatch();

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition-colors duration-[var(--duration-state)] ease-[var(--ease-enter)] motion-reduce:transition-none",
        flash && "bg-muted",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {opening?.title ?? application.openingId}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {opening?.org}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t(m.applications.remove)}
          className="text-muted-foreground"
          onClick={() => dispatch("application.remove", { id: application.id })}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <StatusRow application={application} />

      {/* The next step is shown, not hidden behind a click. Somebody who opens
          this screen has already decided to do something today. */}
      <div className="mt-3 border-t border-border pt-3">
        <p className="text-xs font-medium">{t(m.applications.nextStep)}</p>
        <p className="mt-0.5 text-sm">{nextStep(application.status)[locale]}</p>
        {opening && <AskCoach application={application} opening={opening} />}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t(m.applications.deadlineLabel)}
          </Label>
          <Input
            type="date"
            value={application.deadline ?? ""}
            onChange={(event) =>
              dispatch(
                "application.setDeadline",
                { id: application.id, deadline: event.target.value },
                { silent: true },
              )
            }
            className="h-9 text-sm tabular-nums"
          />
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t(m.applications.notesLabel)}
        </Label>
        <NotesBox
          value={application.notes}
          placeholder={t(m.applications.notesPlaceholder)}
          label={t(m.applications.notesLabel)}
          onCommit={(notes) =>
            dispatch(
              "application.setNotes",
              { id: application.id, notes },
              { silent: true },
            )
          }
        />
      </div>

      <Tailoring application={application} opening={opening} />
    </div>
  );
}

/**
 * The stages, as buttons.
 *
 * Only the moves the model allows are offered, so the interface cannot suggest
 * a transition the reducer would silently drop. `rejected` sits apart because
 * it is not a fifth stage on the line: it can arrive from anywhere and it stops
 * the progression.
 */
function StatusRow({ application }: { application: Application }) {
  const { t, m } = useT();
  const dispatch = useDispatch();

  const set = (status: ApplicationStatus) =>
    dispatch("application.setStatus", { id: application.id, status });

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1">
      {FORWARD_STATUSES.map((status) => {
        const current = application.status === status;
        return (
          <Button
            key={status}
            variant={current ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "transition-colors duration-[var(--duration-press)] ease-[var(--ease-snap)] motion-reduce:transition-none",
              current ? undefined : "text-muted-foreground",
            )}
            disabled={!current && !canTransition(application.status, status)}
            onClick={() => set(status)}
          >
            {t(m.applications[STATUS_LABEL[status]])}
          </Button>
        );
      })}
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      {application.status === "rejected" ? (
        <Badge variant="destructive">{t(m.applications.statusRejected)}</Badge>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => set("rejected")}
        >
          {t(m.applications.statusRejected)}
        </Button>
      )}
    </div>
  );
}

/** Hands the Coach the question, with the job and the stage already in it. */
function AskCoach({
  application,
  opening,
}: {
  application: Application;
  opening: Opening;
}) {
  const { t, m, locale } = useT();
  const thread = useCoach();
  const status = t(m.applications[STATUS_LABEL[application.status]]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="mt-1 -ml-2 text-muted-foreground"
      disabled={thread.busy}
      onClick={() =>
        thread.send(
          m.applications.askCoachPrompt(opening.title, opening.org, status)[locale],
        )
      }
    >
      <CoachCat size="sm" />
      {t(m.applications.askCoach)}
    </Button>
  );
}

/**
 * Tailored copies, bound to this application.
 *
 * The copy is the whole point: the original in My Kit is never touched, so a
 * CV cut down for one job cannot quietly become the CV. `resume.duplicate` and
 * `paper.create` already do the copying, so this only binds the result.
 */
function Tailoring({
  application,
  opening,
}: {
  application: Application;
  opening: Opening | undefined;
}) {
  const state = useAppState();
  const { t, m, locale } = useT();
  const dispatch = useDispatch();

  const tailored = [
    ...state.resumes.filter((resume) =>
      application.tailoredDocumentIds.includes(resume.id),
    ).map((resume) => ({ id: resume.id, label: resume.label, href: "/cv" })),
    ...state.papers.filter((paper) =>
      application.tailoredDocumentIds.includes(paper.id),
    ).map((paper) => ({ id: paper.id, label: paper.label, href: "/papers" })),
  ];

  const base = state.resumes[0];
  const label = opening
    ? `${opening.title}${opening.org ? ` · ${opening.org}` : ""}`
    : t(m.applications.title);

  return (
    <div className="mt-3 border-t border-border pt-3">
      {tailored.length > 0 && (
        <>
          <p className="text-xs font-medium">{t(m.applications.tailoredHeading)}</p>
          <ul className="mt-1 space-y-1">
            {tailored.map((document) => (
              <li key={document.id} className="text-xs">
                <Link href={document.href} className="underline underline-offset-4">
                  {document.label}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {base ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              dispatch("application.tailorResume", {
                id: application.id,
                resumeId: base.id,
                label: `CV · ${label}`,
              })
            }
          >
            {t(m.applications.tailorCv)}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t(m.applications.tailorNeedsCv)}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            dispatch("application.tailorLetter", {
              id: application.id,
              label: `${paperKindLabels["cover-letter"][locale]} · ${label}`,
              targetRole: opening?.title ?? "",
            })
          }
        >
          {t(m.applications.tailorLetter)}
        </Button>
      </div>
    </div>
  );
}

/** A textarea that commits on blur, the same as every other one here. */
function NotesBox({
  value,
  placeholder,
  label,
  onCommit,
}: {
  value: string;
  placeholder: string;
  label: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = React.useState(value);
  const [given, setGiven] = React.useState(value);
  if (value !== given) {
    setGiven(value);
    setDraft(value);
  }

  return (
    <Textarea
      value={draft}
      aria-label={label}
      placeholder={placeholder}
      rows={3}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => draft.trim() !== value && onCommit(draft.trim())}
      className="resize-none text-sm"
    />
  );
}
