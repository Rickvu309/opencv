"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  Circle,
  Crosshair,
  Megaphone,
  Trash2,
  X,
} from "lucide-react";

import { stages, type PathEdge, type PathNode } from "@/lib/career-graph";
import { fitDetail, fitFor } from "@/lib/career-fit";
import { useAppState } from "@/lib/actions/store";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

/** Inspector: lives inside the page frame, not a modal covering the diagram. */
export function NodeInspector({
  node,
  nodes,
  edges,
  isTarget,
  onRoute,
  onClose,
  onSetTarget,
  onRemove,
}: {
  node: PathNode;
  nodes: PathNode[];
  edges: PathEdge[];
  isTarget: boolean;
  onRoute: boolean;
  onClose: () => void;
  onSetTarget: () => void;
  onRemove: () => void;
}) {
  const { t, m, locale } = useT();
  // Computed here rather than passed in: every caller would have to remember
  // to, and the map already renders this node's number from the same function.
  const { profile } = useAppState();
  const fit = fitFor(profile, node);
  const incoming = edges.filter((e) => e.to === node.id);
  const outgoing = edges.filter((e) => e.from === node.id);
  const title = (id: string) => nodes.find((n) => n.id === id)?.title ?? id;
  const stage = stages.find((s) => s.id === node.stage);

  return (
    <aside
      aria-label={t(m.map.detailOf(node.title))}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className={cn(
        // Mobile: bottom sheet. From sm: a real right column that never covers the diagram.
        "absolute inset-x-0 bottom-0 z-10 flex max-h-[60%] flex-col border-t bg-card",
        "sm:static sm:z-auto sm:max-h-none sm:w-80 sm:shrink-0 sm:border-t-0 sm:border-l",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-[var(--duration-surface)] motion-safe:ease-enter sm:motion-safe:slide-in-from-bottom-0 sm:motion-safe:slide-in-from-right-4",
      )}
    >
      <div className="flex shrink-0 items-start gap-2 border-b py-3 pr-2 pl-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            {stage && `${t(stage.label)} · ${t(stage.horizon)}`}
          </p>
          <h2 className="mt-0.5 text-base font-semibold tracking-tight">
            {node.title}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label={t(m.map.closeDetail)}
          className="text-muted-foreground"
        >
          <X />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <p className="text-sm leading-relaxed">{t(node.summary)}</p>
          {(node.requires !== undefined || node.salary) && (
            <dl className="mt-3 grid grid-cols-2 gap-3">
              {node.requires !== undefined && (
                <div>
                  <dt className="text-xs text-muted-foreground">{t(m.map.fitScore)}</dt>
                  <dd className="mt-0.5 text-lg font-semibold tracking-tight tabular-nums">
                    {fit.score}%
                  </dd>
                </div>
              )}
              {node.salary && (
                <div>
                  <dt className="text-xs text-muted-foreground">{t(m.map.salary)}</dt>
                  <dd className="mt-0.5 text-sm font-medium tabular-nums">
                    {t(node.salary)}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {node.does && node.does.length > 0 && (
          <div className="border-t px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              {t(node.id === "you" ? m.map.youHave : m.map.roleDoes)}
            </p>
            <ul className="mt-2 space-y-2">
              {node.does.map((d) => (
                <li key={t(d)} className="flex gap-2.5 text-sm">
                  <span
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                    aria-hidden
                  />
                  <span className="min-w-0 leading-relaxed">{t(d)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {node.requires && node.requires.length > 0 && (
          <div className="border-t px-4 py-3">
            <p className="flex items-baseline justify-between gap-2 text-xs font-medium text-muted-foreground">
              {t(m.map.roleRequires)}
              {fitDetail(fit, locale) && (
                <span className="font-normal tabular-nums">
                  {fitDetail(fit, locale)}
                </span>
              )}
            </p>
            {/* Ticked when the profile evidences it, hollow when it does not.
                The percentage on the node is this list counted; showing the
                number without the list would be the old made-up score with
                extra steps. */}
            <ul className="mt-2 space-y-2">
              {node.requires.map((r) => {
                const done = fit.met.includes(r);
                return (
                  <li key={t(r.label)} className="flex gap-2.5 text-sm">
                    {done ? (
                      <Check
                        className="mt-0.5 size-3.5 shrink-0 text-foreground"
                        aria-label={t(m.map.requirementMet)}
                      />
                    ) : (
                      <Circle
                        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50"
                        aria-label={t(m.map.requirementMissing)}
                      />
                    )}
                    <span
                      className={cn(
                        "min-w-0 leading-relaxed",
                        !done && "text-muted-foreground",
                      )}
                    >
                      {t(r.label)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {incoming.length > 0 && (
          <div className="border-t px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">{t(m.map.comesFrom)}</p>
            <ul className="mt-2 space-y-2">
              {incoming.map((e) => (
                <li key={`${e.from}-${e.to}`} className="text-sm">
                  <p className="font-medium">{title(e.from)}</p>
                  {e.via && (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {t(e.via)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {outgoing.length > 0 && (
          <div className="border-t px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              {t(m.map.leadsTo)}
            </p>
            <ul className="mt-2 space-y-2">
              {outgoing.map((e) => (
                <li key={`${e.from}-${e.to}`} className="text-sm">
                  <p className="font-medium">{title(e.to)}</p>
                  {e.via && (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {t(e.via)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-1 border-t p-2">
        {node.id !== "you" && (
          <Button
            variant={isTarget ? "outline" : "default"}
            size="sm"
            className="w-full justify-start"
            onClick={onSetTarget}
            disabled={isTarget}
          >
            <Crosshair className="size-3.5" />
            {t(isTarget ? m.map.isGoal : m.map.setAsGoal)}
          </Button>
        )}
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="w-full justify-between"
        >
          <Link
            href={`/coach?q=${encodeURIComponent(
              t(
                node.id === "you"
                  ? m.map.askAboutYouPrompt
                  : m.map.askAboutRolePrompt(node.title),
              ),
            )}`}
          >
            <span className="flex items-center gap-1.5">
              <Megaphone className="size-3.5" />
              {t(m.map.askAboutRole)}
            </span>
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        {onRoute && !isTarget && node.id !== "you" && (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            {t(m.map.onRoute)}
          </p>
        )}
        {node.custom && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
            {t(m.map.removeFromMap)}
          </Button>
        )}
      </div>
    </aside>
  );
}
