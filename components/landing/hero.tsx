"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WaitlistForm, useHasJoinedWaitlist } from "@/components/waitlist-form";
import { CoachDemo } from "@/components/landing/coach-demo";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

const press =
  "active:scale-[0.96] transition-transform duration-[var(--duration-press)] ease-snap motion-reduce:transition-none";

function Chunk({
  i,
  className,
  children,
}: {
  i: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("hero-enter", className)}
      style={{ animationDelay: `${i * 100}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * One job: make a student understand, in the two sentences they will give it,
 * what this is and why it is different. The product frame is that difference,
 * visible, so the grey sentence under the fold is no longer the first proof.
 */
export function LandingHero() {
  const [showWaitlist, setShowWaitlist] = React.useState(false);
  const alreadyJoined = useHasJoinedWaitlist();
  const { t, m } = useT();

  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-20">
      <div>
        <Chunk i={0}>
          <p className="text-sm text-muted-foreground">{t(m.landing.audience)}</p>
        </Chunk>
        <Chunk i={1}>
          <h1 className="mt-3 text-4xl leading-[1.2] font-semibold tracking-display text-balance sm:text-5xl sm:leading-[1.15]">
            <span className="block">{t(m.landing.headline1)}</span>
            <span className="block">{t(m.landing.headline2)}</span>
          </h1>
        </Chunk>
        <Chunk i={2}>
          <p className="mt-5 max-w-lg text-base text-muted-foreground text-pretty">
            {t(m.landing.subhead)}
          </p>
        </Chunk>
        <Chunk i={3}>
          <div className="mt-9 flex w-full max-w-xs flex-col items-stretch gap-2 sm:max-w-none sm:flex-row sm:items-center sm:gap-3">
            <Button asChild size="lg" className={cn("h-11 px-5 sm:h-10", press)}>
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
                className="h-11 px-5 text-muted-foreground sm:h-10"
              >
                {t(m.landing.joinWaitlist)}
              </Button>
            )}
          </div>

          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] motion-reduce:transition-none",
              showWaitlist
                ? "mt-6 grid-rows-[1fr] opacity-100 duration-[var(--duration-state)] ease-enter"
                : "grid-rows-[0fr] opacity-0 duration-[var(--duration-state)] ease-exit",
            )}
          >
            <div className="overflow-hidden">
              {showWaitlist && (
                <>
                  {!alreadyJoined && (
                    <p className="mb-2.5 text-sm text-muted-foreground">
                      {t(m.landing.waitlistLead)}
                    </p>
                  )}
                  <WaitlistForm source="landing" autoFocus />
                </>
              )}
            </div>
          </div>

          {alreadyJoined && !showWaitlist && (
            <p className="mt-6 text-sm text-muted-foreground">
              {t(m.landing.alreadyJoined)}
            </p>
          )}
        </Chunk>
      </div>

      <Chunk i={4} className="lg:justify-self-end lg:w-full lg:max-w-lg">
        <CoachDemo />
      </Chunk>
    </section>
  );
}
