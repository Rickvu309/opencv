"use client";

// The reason to answer the next question.
//
// The old flow asked four screens of questions and showed nothing back until
// the end. Nothing computed, nothing moved, and the justification for any of it
// sat in eleven-point grey in the opposite corner. It read as a form because it
// behaved like one.
//
// This is the other half of the bargain: every field the user fills moves a
// number they can see, against the role they said they wanted, with the
// requirements they have and have not met listed underneath.
//
// It scores against the goal the user has just stated, which is what WO-64
// asks for. That used to be described as "the same figure the career map
// shows"; the map is retired and the roles it drew are now a catalogue this
// screen owns, so the sentence went with it. The calculation did not change.

import { Check, Circle } from "lucide-react";

import { fitFor, rankByFit, type FitProfile } from "@/lib/career-fit";
import { pathNodes, type PathNode } from "@/lib/career-graph";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export function FitPanel({
  profile,
  targetId,
}: {
  profile: FitProfile;
  /** The role they chose, or null when they said they are not sure yet. */
  targetId: string | null;
}) {
  const { t, m, locale } = useT();

  // Not sure yet is the interesting case, not the dead end it used to be:
  // rather than nothing to show, they get the role they are *currently*
  // closest to, which is an answer to the question that brought them here.
  const ranked = rankByFit(profile, pathNodes);
  const node: PathNode | undefined = targetId
    ? pathNodes.find((n) => n.id === targetId)
    : ranked[0]?.node;
  if (!node) return null;

  const fit = fitFor(profile, node);
  const total = fit.met.length + fit.missing.length;

  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <p className="text-xs text-muted-foreground">
        {targetId ? t(m.onboarding.fitFor) : t(m.onboarding.fitClosest)}
      </p>

      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium">{node.title}</p>
        <p className="shrink-0 text-2xl font-semibold tracking-tight tabular-nums">
          {fit.score}%
        </p>
      </div>

      {/* The bar is the same one the map draws, so the two agree on sight. */}
      <span
        aria-hidden
        className="mt-2 block h-1 overflow-hidden rounded-full bg-muted"
      >
        <span
          className="block h-full rounded-full bg-foreground transition-[width] duration-[var(--duration-surface)] ease-enter motion-reduce:transition-none"
          style={{ width: `${fit.score}%` }}
        />
      </span>

      {total > 0 && (
        <ul className="mt-3 space-y-1.5">
          {[...fit.met, ...fit.missing].map((requirement) => {
            const done = fit.met.includes(requirement);
            return (
              <li
                key={requirement.label.en}
                className={cn(
                  "flex items-start gap-2 text-xs leading-5",
                  done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {done ? (
                  <Check
                    className="mt-0.5 size-3 shrink-0"
                    aria-label={t(m.onboarding.requirementMet)}
                  />
                ) : (
                  <Circle
                    className="mt-0.5 size-3 shrink-0 opacity-50"
                    aria-label={t(m.onboarding.requirementMissing)}
                  />
                )}
                <span className="min-w-0">{requirement.label[locale]}</span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Said once, plainly. The number is low at the start for everyone, and a
          student reading a low number about themselves deserves to know it is
          the starting line rather than a verdict. */}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {t(m.onboarding.fitNote)}
      </p>
    </div>
  );
}
