"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, FileText, Route, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WaitlistForm, useHasJoinedWaitlist } from "@/components/waitlist-form";
import { useT } from "@/lib/i18n/use-t";
import { LanguageToggle } from "@/components/language-toggle";

/**
 * The page has to do one thing: make a student understand, in the two sentences
 * they will give it, what this is and why it is different from the six career
 * sites they have already closed.
 *
 * ## What changed, and why the old page was not enough
 *
 * The previous version was three short declarations and a waiting list. It read
 * well and it sold nothing: "hiểu bản thân, chọn đúng hướng, biết bắt đầu từ
 * đâu" is what every careers service in the country says, and none of it tells
 * the reader that the Coach here actually writes the CV rather than advising
 * them to write one. That difference is the product, and it was invisible.
 *
 * ## What is deliberately not here
 *
 * No testimonials, no "10,000 students", no logos of companies nobody placed
 * anyone at. The product's first principle is evidence over encouragement, and
 * a landing page that opens with an invented number has broken that promise
 * before the visitor has signed up. What is here instead is the specific,
 * checkable claim: the Coach edits your work, and you can undo it.
 */
export default function Home() {
  // The waiting list opens in place rather than on its own route: a visitor who
  // is reading the page should not have to leave it to leave an address.
  const [showWaitlist, setShowWaitlist] = React.useState(false);
  const alreadyJoined = useHasJoinedWaitlist();
  const { t, m } = useT();

  return (
    <main className="relative flex min-h-svh flex-1 flex-col items-center px-6 py-16">
      {/* Offered before anything is read, not buried in a menu the visitor has
          not found yet: this is the first screen, and half its readers may not
          read Vietnamese. */}
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <div className="flex w-full max-w-2xl flex-1 flex-col items-center justify-center text-center">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Route className="size-5" />
          </span>
          <span className="text-xl font-semibold tracking-tight">OpenPath</span>
        </div>

        {/* Said before the headline rather than after it. A student scanning
            this needs to know it is for them before they decide whether the
            promise is worth reading. */}
        <p className="mt-8 text-sm text-muted-foreground">{t(m.landing.audience)}</p>

        {/* Leading is looser on mobile, not tighter: the heading wraps there,
            and Vietnamese stacked tone marks (ể, ứ, ầ) need the room. */}
        <h1 className="mt-3 text-4xl leading-[1.2] font-semibold tracking-display text-balance sm:text-5xl sm:leading-[1.15]">
          <span className="block">{t(m.landing.headline1)}</span>
          <span className="block">{t(m.landing.headline2)}</span>
        </h1>

        <p className="mt-5 max-w-lg text-base text-muted-foreground text-pretty">
          {t(m.landing.subhead)}
        </p>

        {/* Two doors, preferred first. The old page had two buttons that both
            led into the product, so a visitor who was interested but not ready
            had nowhere to go and left no trace. */}
        <div className="mt-9 flex w-full max-w-xs flex-col items-center gap-2 sm:w-auto sm:max-w-none sm:flex-row sm:gap-3">
          {/* To account creation rather than straight into onboarding: the
              product keeps your work under a name, and answering questions
              before there is anywhere to put the answers would mean losing
              them. Sign-up hands over to onboarding immediately. */}
          <Button asChild size="lg" className="h-11 w-full px-5 sm:h-10 sm:w-auto">
            <Link href="/sign-up">
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
            action stays available to someone who changes their mind. Stays
            mounted after joining so the form can show its own confirmation. */}
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

        {alreadyJoined && !showWaitlist && (
          <p className="mt-6 text-sm text-muted-foreground">
            {t(m.landing.alreadyJoined)}
          </p>
        )}
      </div>

      {/* Below the fold on purpose. Somebody convinced by the hero should not
          have to scroll past an explanation to reach the button. */}
      <section className="mt-20 w-full max-w-3xl">
        <h2 className="text-center text-sm font-medium text-muted-foreground">
          {t(m.landing.pillarsHeading)}
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Pillar
            icon={FileText}
            title={t(m.landing.pillar1Title)}
            body={t(m.landing.pillar1Body)}
          />
          <Pillar
            icon={Search}
            title={t(m.landing.pillar2Title)}
            body={t(m.landing.pillar2Body)}
          />
        </div>
      </section>

      <section className="mt-14 w-full max-w-3xl">
        <h2 className="text-center text-sm font-medium text-muted-foreground">
          {t(m.landing.howHeading)}
        </h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-3">
          {[t(m.landing.how1), t(m.landing.how2), t(m.landing.how3)].map(
            (step, index) => (
              <li key={step} className="rounded-xl border bg-card p-4">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <p className="mt-1 text-sm">{step}</p>
              </li>
            ),
          )}
        </ol>
        {/* The differentiator, stated plainly, because it is also the thing a
            reader is right to be suspicious of. An agent that edits your work
            is only acceptable if you can see it and take it back. */}
        <p className="mt-5 text-center text-sm text-muted-foreground text-pretty">
          {t(m.landing.controlNote)}
        </p>
      </section>

      <div className="mt-14 mb-4">
        <Button asChild size="lg" className="h-11 px-5">
          <Link href="/sign-up">
            {t(m.landing.tryIt)}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>
    </main>
  );
}

function Pillar({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-4" />
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">{body}</p>
    </div>
  );
}
