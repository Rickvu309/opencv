"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { disclose, discloseInner } from "@/components/ui/disclose";
import { WaitlistForm, useHasJoinedWaitlist } from "@/components/waitlist-form";
import { messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

const press =
  "active:scale-[0.96] transition-transform duration-[var(--duration-press)] ease-snap motion-reduce:transition-none";

const copy = messages.landing;

function LandingDoors() {
  const [showWaitlist, setShowWaitlist] = React.useState(false);
  const alreadyJoined = useHasJoinedWaitlist();

  return (
    <div className="flex flex-col items-start gap-6">
      <Button asChild size="lg" className={cn("h-11 px-5", press)}>
        <Link href="/sign-up">{copy.tryIt}</Link>
      </Button>

      {!alreadyJoined && !showWaitlist && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{copy.joinWaitlistAsk}</p>
          <Button
            variant="link"
            size="lg"
            aria-expanded={false}
            onClick={() => setShowWaitlist(true)}
            className="h-11 justify-start px-0 text-foreground underline underline-offset-4"
          >
            {copy.joinWaitlist}
          </Button>
        </div>
      )}

      {alreadyJoined && (
        <p className="text-sm text-muted-foreground">{copy.alreadyJoined}</p>
      )}

      <div className={cn("w-full max-w-md", disclose(showWaitlist && !alreadyJoined))}>
        <div className={discloseInner}>
          {showWaitlist && !alreadyJoined && (
            <>
              <p className="mb-2.5 text-sm text-muted-foreground">
                {copy.waitlistLead}
              </p>
              <WaitlistForm source="landing" autoFocus />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Who, promise, permission, doors. English only on this pass.
 */
export function LandingStory() {
  return (
    <div className="flex max-w-2xl flex-col">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{copy.audience}</p>
        <h1 className="text-balance text-5xl font-semibold leading-[1.15] tracking-tight text-foreground sm:text-6xl">
          {copy.headline}
        </h1>
        <p className="text-pretty text-xl font-medium leading-snug tracking-tight text-foreground sm:text-2xl">
          {copy.headlineNext}
        </p>
      </div>
      <p className="mt-6 max-w-[40ch] text-pretty text-[15px] leading-7 text-foreground">
        {copy.subhead}
      </p>
      <div className="mt-16 flex flex-col gap-3 sm:mt-24">
        <p className="text-sm text-muted-foreground">{copy.close}</p>
        <LandingDoors />
      </div>
    </div>
  );
}
