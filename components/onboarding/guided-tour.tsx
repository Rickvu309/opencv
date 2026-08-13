"use client";

import * as React from "react";
import { ArrowRight, Files, Search, Sparkles, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";

/**
 * Four cards between finishing setup and meeting the Coach.
 *
 * ## Why the app runs this and not the Coach
 *
 * A Coach-led tour would be the obvious flourish and the wrong first
 * impression: it puts a model call between the user and the product at the one
 * moment they have no patience for latency, and it introduces the Coach by
 * having it talk about itself. The tour is four short cards the app owns, and
 * the Coach's introduction is the Coach actually doing something, one screen
 * later.
 *
 * ## The order of the cards
 *
 * Deliberate. The first says the Coach edits your work, which is the
 * differentiator and also the alarming part. The second is the undo promise,
 * because a reader who has just been told an agent will rewrite their CV needs
 * that sentence immediately rather than three cards later.
 */
export function GuidedTour({ onDone }: { onDone: () => void }) {
  const { t, m } = useT();
  const [at, setAt] = React.useState(0);

  const cards = [
    { icon: Sparkles, title: m.onboarding.tour1Title, body: m.onboarding.tour1Body },
    { icon: Undo2, title: m.onboarding.tour2Title, body: m.onboarding.tour2Body },
    { icon: Files, title: m.onboarding.tour3Title, body: m.onboarding.tour3Body },
    { icon: Search, title: m.onboarding.tour4Title, body: m.onboarding.tour4Body },
  ];

  const card = cards[at];
  const last = at === cards.length - 1;
  const Icon = card.icon;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <div
        // Keyed on the step so each card animates in as its own element rather
        // than the text swapping inside a static box. Under reduced motion the
        // counter and the changed words carry it.
        key={at}
        className="rounded-xl border bg-card p-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-2 motion-safe:duration-[var(--duration-state)] motion-safe:ease-enter"
      >
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Icon className="size-4" />
        </span>
        <h2 className="mt-4 text-lg font-semibold tracking-tight">
          {t(card.title)}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          {t(card.body)}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        {/* Skippable from the first card, not only the last: somebody who has
            used the product before should not have to click through four
            screens to get back into it. AC-ONB-004.3. */}
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={onDone}
        >
          {t(m.onboarding.tourSkip)}
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t(m.onboarding.tourStep(at + 1, cards.length))}
        </span>
        <Button
          size="sm"
          onClick={() => (last ? onDone() : setAt((was) => was + 1))}
        >
          {t(last ? m.onboarding.tourDone : m.onboarding.tourNext)}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}
