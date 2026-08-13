"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Compass, ListChecks, Route, UserSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WaitlistForm, useHasJoinedWaitlist } from "@/components/waitlist-form";
import { useT } from "@/lib/i18n/use-t";
import { LanguageToggle } from "@/components/language-toggle";

export default function Home() {
  // The waiting list opens in place rather than on its own route: a visitor who
  // is reading the page should not have to leave it to leave an address.
  const [showWaitlist, setShowWaitlist] = React.useState(false);
  const alreadyJoined = useHasJoinedWaitlist();
  const { t, m } = useT();
  const features = [
    { icon: UserSearch, label: t(m.landing.feature1) },
    { icon: Compass, label: t(m.landing.feature2) },
    { icon: ListChecks, label: t(m.landing.feature3) },
  ];

  return (
    <main className="relative flex min-h-svh flex-1 flex-col items-center justify-center px-6 py-16">
      {/* Offered before anything is read, not buried in a menu the visitor has
          not found yet: this is the first screen, and half its readers may not
          read Vietnamese. */}
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      <div className="flex w-full max-w-2xl flex-col items-center text-center">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Route className="size-5" />
          </span>
          <span className="text-xl font-semibold tracking-tight">OpenPath</span>
        </div>

        {/* Leading is looser on mobile, not tighter: the heading wraps to four
            lines there, and Vietnamese stacked tone marks (ể, ứ, ầ) need the
            room. Tailwind's text-4xl default of 1.11 was the tightest setting
            on the most crowded layout. */}
        <h1 className="mt-10 text-4xl leading-[1.2] font-semibold tracking-display text-balance sm:text-5xl sm:leading-[1.15]">
          {/* One sentence per line at every width. The copy is three short
              declarations, and letting them reflow put the end of one sentence
              and the start of the next on the same line at both widths. */}
          <span className="block">{t(m.landing.headline1)}</span>
          <span className="block">{t(m.landing.headline2)}</span>
          {/* Non-breaking space inside "bắt đầu": it is one word in two
              syllables, and a line break between them reads like hyphenating
              "be-gin". English has no equivalent hazard here. */}
          <span className="block">
            {t(m.landing.headline3).replace("bắt đầu", "bắt\u00A0đầu")}
          </span>
        </h1>
        <p className="mt-5 max-w-md text-base text-muted-foreground text-pretty">
          {t(m.landing.subhead)}
        </p>

        {/* Two doors, preferred first. The old page had two buttons that both
            led into the product, so a visitor who was interested but not ready
            had nowhere to go and left no trace. */}
        <div className="mt-9 flex w-full max-w-xs flex-col items-center gap-2 sm:w-auto sm:max-w-none sm:flex-row sm:gap-3">
          <Button asChild size="lg" className="h-11 w-full px-5 sm:h-10 sm:w-auto">
            <Link href="/onboarding">
              {t(m.landing.tryIt)}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          {!showWaitlist && !alreadyJoined && (
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setShowWaitlist(true)}
              className="h-11 w-full px-5 text-muted-foreground sm:h-10 sm:w-auto"
            >
              {t(m.landing.joinWaitlist)}
            </Button>
          )}
        </div>

        {/* Opens under the buttons rather than replacing them: the primary
            action stays available to someone who changes their mind. */}
        {/* Stays mounted after joining so the form can show its own
            confirmation. Unmounting on success would swap "xong rồi" for
            "you are already on the list", which reads as if the submit did
            nothing. */}
        {showWaitlist && (
          <div className="mt-6 w-full max-w-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-[var(--duration-state)] motion-safe:ease-enter">
            {!alreadyJoined && (
              <p className="mb-2.5 text-sm text-muted-foreground">
                {t(m.landing.waitlistLead)}
              </p>
            )}
            <WaitlistForm source="landing" autoFocus />
          </div>
        )}

        {/* Only for someone who joined on an earlier visit. */}
        {alreadyJoined && !showWaitlist && (
          <p className="mt-6 text-sm text-muted-foreground">
            {t(m.landing.alreadyJoined)}
          </p>
        )}

        {/* One per line on mobile. Side by side, each label wrapped to two
            lines and left its icon stranded against a two-line block. */}
        <div className="mt-12 flex flex-col items-center gap-3 text-sm text-muted-foreground sm:mt-16 sm:flex-row sm:gap-8">
          {features.map((feature) => (
            <span key={feature.label} className="flex items-center gap-2">
              <feature.icon aria-hidden className="size-4 shrink-0 text-primary" />
              {feature.label}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
