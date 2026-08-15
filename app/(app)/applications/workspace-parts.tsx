"use client";

import * as React from "react";
import { Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
import { nextId } from "@/lib/ids";
import { paperTypeLabels, cvsOf } from "@/lib/paper";
import {
  fitProfileOf,
  hasProfileFacts,
  openingFit,
  type OpeningFit,
} from "@/lib/search/fit";
import { openingById, type Opening } from "@/lib/search/types";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<
  ApplicationStatus,
  "statusInterested" | "statusApplied" | "statusInterviewing" | "statusOffer" | "statusRejected"
> = {
  interested: "statusInterested",
  applied: "statusApplied",
  interviewing: "statusInterviewing",
  offer: "statusOffer",
  rejected: "statusRejected",
};

export type ApplicationItem = {
  application: Application;
  opening: Opening | undefined;
};

export type BoardJob = {
  opening: Opening;
  application: Application | undefined;
  fit: OpeningFit | undefined;
};

export function useApplicationsWorkspace() {
  const state = useAppState();
  const { t, m } = useT();
  const touched = useTouched();
  const ordered = byUrgency(state.applications);
  const items: ApplicationItem[] = ordered.map((application) => ({
    application,
    opening: openingById(state.openings, application.openingId),
  }));

  const attached = new Set(state.applications.map((app) => app.openingId));
  const profile = fitProfileOf(state);
  const ranked = hasProfileFacts(state);
  const board: BoardJob[] = state.openings
    .filter((opening) => opening.saved || attached.has(opening.id))
    .map((opening) => ({
      opening,
      application: state.applications.find((app) => app.openingId === opening.id),
      fit: ranked ? openingFit(profile, opening) : undefined,
    }))
    .sort((a, b) => {
      if (ranked && a.fit && b.fit) {
        const ratio = (fit: OpeningFit) =>
          fit.total === 0 ? -1 : fit.metCount / fit.total;
        const diff = ratio(b.fit) - ratio(a.fit);
        if (diff !== 0) return diff;
      }
      return b.opening.addedAt - a.opening.addedAt;
    });

  return { items, ordered, state, touched, t, m, board, hasFit: ranked };
}

export type ApplicationsWorkspaceProps = ReturnType<typeof useApplicationsWorkspace>;

export function statusLabel(
  status: ApplicationStatus,
  t: ReturnType<typeof useT>["t"],
  m: ReturnType<typeof useT>["m"],
) {
  return t(m.applications[STATUS_LABEL[status]]);
}

export function EmptyApplications() {
  const { t, m } = useT();

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-medium">{t(m.applications.emptyTitle)}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t(m.applications.emptyBody)}</p>
      <Button asChild variant="outline" size="sm" className="mt-3">
        <Link href="/search">{t(m.applications.emptyAction)}</Link>
      </Button>
    </div>
  );
}

export function isOverdue(application: Application) {
  if (application.status === "rejected" || !application.deadline) return false;
  return application.deadline < new Date().toISOString().slice(0, 10);
}

export function ApplicationDetailPanel({
  application,
  opening,
  showHeader = true,
}: ApplicationItem & { showHeader?: boolean }) {
  const { t, m } = useT();
  const dispatch = useDispatch();

  return (
    <>
      {showHeader && (
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
      )}

      <StatusRow application={application} />

      <div className="mt-3 border-t border-border pt-3">
        <p className="text-xs font-medium">{t(m.applications.nextStep)}</p>
        <p className="mt-0.5 text-sm">{nextStep(application.status)}</p>
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
    </>
  );
}

export function StatusRow({
  application,
  compact = false,
}: {
  application: Application;
  compact?: boolean;
}) {
  const { t, m } = useT();
  const dispatch = useDispatch();

  const set = (status: ApplicationStatus) =>
    dispatch("application.setStatus", { id: application.id, status });

  return (
    <div className={cn("flex flex-wrap items-center gap-1", !compact && "mt-3")}>
      {FORWARD_STATUSES.map((status) => {
        const current = application.status === status;
        return (
          <Button
            key={status}
            variant={current ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              compact && "h-7 px-2 text-xs",
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
      {!compact && (
        <>
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
        </>
      )}
    </div>
  );
}

export function AskCoach({
  application,
  opening,
}: {
  application: Application;
  opening: Opening;
}) {
  const { t, m } = useT();
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
          m.applications.askCoachPrompt(opening.title, opening.org, status),
        )
      }
    >
      <Sparkles className="size-3.5" />
      {t(m.applications.askCoach)}
    </Button>
  );
}

export function Tailoring({
  application,
  opening,
}: {
  application: Application;
  opening: Opening | undefined;
}) {
  const state = useAppState();
  const { t, m } = useT();
  const dispatch = useDispatch();
  const router = useRouter();

  const tailored = state.paper
    .filter((item) => application.tailoredDocumentIds.includes(item.id))
    .map((item) => ({
      id: item.id,
      label: item.label,
      href: `/paper?id=${encodeURIComponent(item.id)}`,
    }));

  const base = cvsOf(state.paper)[0];
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
            onClick={() => {
              const paperId = nextId(
                "paper",
                state.paper.map((item) => item.id),
              );
              dispatch("application.tailorCv", {
                id: application.id,
                paperId: base.id,
                label: `CV · ${label}`,
              });
              router.push(`/paper?id=${encodeURIComponent(paperId)}`);
            }}
          >
            {t(m.applications.tailorCv)}
          </Button>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <Link href="/paper?new=cv">{t(m.applications.tailorNeedsCv)}</Link>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const paperId = nextId(
              "paper",
              state.paper.map((item) => item.id),
            );
            dispatch("application.tailorLetter", {
              id: application.id,
              label: `${paperTypeLabels.letter} · ${label}`,
              targetRole: opening?.title ?? "",
            });
            router.push(`/paper?id=${encodeURIComponent(paperId)}`);
          }}
        >
          {t(m.applications.tailorLetter)}
        </Button>
      </div>
    </div>
  );
}

export function NotesBox({
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

