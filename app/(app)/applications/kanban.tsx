"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useDispatch } from "@/lib/actions/store";
import {
  FORWARD_STATUSES,
  canTransition,
  nextStep,
  type ApplicationStatus,
} from "@/lib/applications/types";
import { useT } from "@/lib/i18n/use-t";
import { disclose, discloseInner } from "@/components/ui/disclose";
import { cn } from "@/lib/utils";
import {
  ApplicationDetailPanel,
  EmptyApplications,
  isOverdue,
  statusLabel,
  type ApplicationsWorkspaceProps,
} from "./workspace-parts";

type DragPayload =
  | { kind: "app"; id: string; from: ApplicationStatus }
  | { kind: "job"; openingId: string };

function parseDrag(event: React.DragEvent): DragPayload | null {
  try {
    return JSON.parse(event.dataTransfer.getData("application/json")) as DragPayload;
  } catch {
    return null;
  }
}

function canDropOn(payload: DragPayload | null, to: ApplicationStatus): boolean {
  if (!payload) return false;
  const from = payload.kind === "app" ? payload.from : "interested";
  if (from === to && payload.kind === "app") return false;
  if (from === to && payload.kind === "job") return true;
  return canTransition(from, to);
}

function nextForward(status: ApplicationStatus): ApplicationStatus | undefined {
  const next = FORWARD_STATUSES[FORWARD_STATUSES.indexOf(status) + 1];
  return next && canTransition(status, next) ? next : undefined;
}

export function ApplicationsKanban(props: ApplicationsWorkspaceProps) {
  const { t, m } = props;
  const dispatch = useDispatch();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [focusOpeningId, setFocusOpeningId] = React.useState<string | null>(null);
  const [endedOpen, setEndedOpen] = React.useState(false);
  const [dragging, setDragging] = React.useState<DragPayload | null>(null);

  React.useEffect(() => {
    if (!focusOpeningId) return;
    const found = props.items.find(
      ({ application }) => application.openingId === focusOpeningId,
    );
    if (!found) return;
    setSelectedId(found.application.id);
    setDrawerOpen(true);
    setFocusOpeningId(null);
  }, [props.items, focusOpeningId]);

  const selected = props.items.find(({ application }) => application.id === selectedId);
  const empty = props.board.length === 0 && props.items.length === 0;
  const ended = props.items.filter(({ application }) => application.status === "rejected");
  const unstarted = props.board.filter((job) => !job.application);

  const openApp = (id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
  };

  const startJob = (openingId: string, status: ApplicationStatus = "interested") => {
    dispatch("application.create", { openingId, status });
    setFocusOpeningId(openingId);
  };

  const moveTo = (payload: DragPayload, to: ApplicationStatus) => {
    if (!canDropOn(payload, to)) return;
    if (payload.kind === "job") {
      startJob(payload.openingId, to);
      if (to === "rejected") setEndedOpen(true);
      return;
    }
    dispatch("application.setStatus", { id: payload.id, status: to });
    if (to === "rejected") setEndedOpen(true);
  };

  const onDragStart = (payload: DragPayload) => (event: React.DragEvent) => {
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.setData(
      "text/plain",
      payload.kind === "app" ? payload.id : payload.openingId,
    );
    event.dataTransfer.effectAllowed = "move";
    setDragging(payload);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-end border-b border-border px-3">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/search">{t(m.applications.addOpenings)}</Link>
        </Button>
      </div>

      {empty ? (
        <div className="p-5">
          <EmptyApplications />
        </div>
      ) : (
        <>
          <div
            className="flex min-h-0 flex-1 divide-x divide-border overflow-x-auto"
            onDragEnd={() => setDragging(null)}
          >
            {FORWARD_STATUSES.map((status) => {
              const cards =
                status === "interested"
                  ? [
                      ...unstarted.map((job) => ({ kind: "job" as const, job })),
                      ...props.items
                        .filter(({ application }) => application.status === status)
                        .map((item) => ({ kind: "app" as const, item })),
                    ]
                  : props.items
                      .filter(({ application }) => application.status === status)
                      .map((item) => ({ kind: "app" as const, item }));
              const accepts = canDropOn(dragging, status);

              return (
                <section
                  key={status}
                  className={cn(
                    "flex w-64 min-w-64 flex-1 flex-col",
                    dragging && accepts && "bg-muted/40",
                    dragging && !accepts && "opacity-40",
                  )}
                  onDragOver={(event) => {
                    if (!canDropOn(dragging, status)) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const payload = parseDrag(event) ?? dragging;
                    if (payload) moveTo(payload, status);
                    setDragging(null);
                  }}
                >
                  <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
                    <h2 className="text-xs text-muted-foreground">
                      {statusLabel(status, t, m)}
                    </h2>
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      {cards.length}
                    </p>
                  </header>
                  <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
                    {cards.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-muted-foreground">
                        {t(m.applications.stationEmpty)}
                      </p>
                    ) : (
                      cards.map((card) =>
                        card.kind === "job" ? (
                          <KanbanCard
                            key={card.job.opening.id}
                            title={card.job.opening.title}
                            org={card.job.opening.org}
                            location={card.job.opening.location}
                            step={nextStep("interested")}
                            fit={card.job.fit}
                            flash={false}
                            selected={false}
                            onDragStart={onDragStart({
                              kind: "job",
                              openingId: card.job.opening.id,
                            })}
                            onOpen={() => startJob(card.job.opening.id)}
                            onAdvance={
                              nextForward("interested")
                                ? () => startJob(card.job.opening.id, "applied")
                                : undefined
                            }
                          />
                        ) : (
                          <KanbanCard
                            key={card.item.application.id}
                            title={
                              card.item.opening?.title ??
                              card.item.application.openingId
                            }
                            org={card.item.opening?.org}
                            location={card.item.opening?.location}
                            deadline={card.item.application.deadline}
                            overdue={isOverdue(card.item.application)}
                            step={nextStep(card.item.application.status)}
                            fit={
                              props.board.find(
                                (job) =>
                                  job.opening.id === card.item.application.openingId,
                              )?.fit
                            }
                            flash={props.touched.includes(card.item.application.id)}
                            selected={
                              card.item.application.id === selectedId && drawerOpen
                            }
                            onDragStart={onDragStart({
                              kind: "app",
                              id: card.item.application.id,
                              from: card.item.application.status,
                            })}
                            onOpen={() => openApp(card.item.application.id)}
                            onAdvance={(() => {
                              const next = nextForward(card.item.application.status);
                              if (!next) return undefined;
                              return () =>
                                dispatch("application.setStatus", {
                                  id: card.item.application.id,
                                  status: next,
                                });
                            })()}
                          />
                        ),
                      )
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          <div
            className={cn(
              "shrink-0 border-t border-border",
              dragging && canDropOn(dragging, "rejected") && "bg-muted/40",
            )}
            onDragOver={(event) => {
              if (!canDropOn(dragging, "rejected")) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              event.preventDefault();
              const payload = parseDrag(event) ?? dragging;
              if (payload) moveTo(payload, "rejected");
              setDragging(null);
            }}
          >
            <button
              type="button"
              onClick={() => setEndedOpen((open) => !open)}
              className="flex h-10 w-full items-center justify-between px-3 text-start text-xs text-muted-foreground outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
            >
              <span>
                {t(m.applications.endedHeading)}
                <span className="ms-2 tabular-nums">
                  {t(m.applications.endedCount(ended.length))}
                </span>
              </span>
              <span aria-hidden>{endedOpen ? "–" : "+"}</span>
            </button>
            <div
              className={disclose(endedOpen && ended.length > 0)}
              inert={!endedOpen || ended.length === 0 || undefined}
            >
              <div className={cn(discloseInner, "divide-y divide-border border-t border-border")}>
                {ended.map((item) => (
                  <KanbanCard
                    key={item.application.id}
                    title={item.opening?.title ?? item.application.openingId}
                    org={item.opening?.org}
                    location={item.opening?.location}
                    deadline={item.application.deadline}
                    step={nextStep(item.application.status)}
                    fit={
                      props.board.find(
                        (job) => job.opening.id === item.application.openingId,
                      )?.fit
                    }
                    flash={props.touched.includes(item.application.id)}
                    selected={item.application.id === selectedId && drawerOpen}
                    muted
                    onDragStart={onDragStart({
                      kind: "app",
                      id: item.application.id,
                      from: item.application.status,
                    })}
                    onOpen={() => openApp(item.application.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {drawerOpen && selected && (
        <>
          <button
            type="button"
            aria-label={t(m.common.close)}
            className="fixed inset-0 z-40 bg-foreground/20"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="fixed inset-y-0 end-0 z-50 flex w-full max-w-md flex-col border-s border-border bg-background shadow-xl motion-safe:animate-in motion-safe:slide-in-from-right motion-safe:duration-[var(--duration-surface)] motion-reduce:animate-none">
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ApplicationDetailPanel {...selected} />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

function KanbanCard({
  title,
  org,
  location,
  deadline,
  overdue,
  step,
  fit,
  flash,
  selected,
  muted,
  onDragStart,
  onOpen,
  onAdvance,
}: {
  title: string;
  org?: string;
  location?: string;
  deadline?: string;
  overdue?: boolean;
  step: string;
  fit: ApplicationsWorkspaceProps["board"][number]["fit"];
  flash: boolean;
  selected: boolean;
  muted?: boolean;
  onDragStart: (event: React.DragEvent) => void;
  onOpen: () => void;
  onAdvance?: () => void;
}) {
  const { t, m } = useT();

  return (
    <article
      draggable
      onDragStart={onDragStart}
      className={cn(
        "px-3 py-2.5 transition-colors duration-[var(--duration-state)] ease-[var(--ease-enter)] motion-reduce:transition-none",
        flash && "bg-muted",
        selected && "bg-muted/50",
        muted && "text-muted-foreground",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-start outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">
            {location || org || "—"}
          </p>
          {fit && fit.total > 0 && (
            <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {t(m.applications.fitCount(fit.metCount, fit.total))}
            </p>
          )}
        </div>
        <h3 className="mt-0.5 text-sm font-medium text-pretty">{title}</h3>
        {org && org !== location && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{org}</p>
        )}
        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{step}</p>
        {deadline && (
          <p
            className={cn(
              "mt-1 text-xs tabular-nums",
              overdue ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {deadline}
          </p>
        )}
      </button>
      {onAdvance && (
        <div className="mt-1.5 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onAdvance();
            }}
          >
            {t(m.applications.advanceStatus)}
          </Button>
        </div>
      )}
    </article>
  );
}
