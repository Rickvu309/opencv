"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { JOINED_KEY, WaitlistForm } from "@/components/waitlist-form";
import { useLocalFlag, writeLocalFlag } from "@/lib/waitlist/use-local-flag";
import { useT } from "@/lib/i18n/use-t";

const ARRIVED_KEY = "openpath:just-onboarded:v1";
const DISMISSED_KEY = "openpath:waitlist-prompt-dismissed:v1";

/**
 * Called by onboarding when it finishes, so the next screen knows the visitor
 * has just done real work rather than merely navigated here.
 *
 * A flag rather than a query parameter: onboarding redirects on a timer, and a
 * `?new=1` would survive in the address bar, in a shared link, and in a reload
 * long after the moment had passed.
 */
export function markJustOnboarded() {
  writeLocalFlag(ARRIVED_KEY);
}

/**
 * The ask, at the end of the demo journey.
 *
 * ## Why here, and why once
 *
 * Onboarding is the earliest honest moment: the visitor has just answered four
 * screens of questions and is looking at the profile those answers produced.
 * The product has demonstrated something. Asking on arrival, before that, is
 * asking a stranger for their address in exchange for nothing.
 *
 * Not a modal, because `PRODUCT.md` principle 4 is "calm under uncertainty" and
 * these users open the app anxious and between classes. Not shown at all if
 * they already joined from the landing page, because asking twice for the same
 * thing reads as not listening. Dismissible, and the dismissal sticks.
 */
export function WaitlistPrompt() {
  const arrived = useLocalFlag(ARRIVED_KEY);
  const dismissed = useLocalFlag(DISMISSED_KEY);
  const joined = useLocalFlag(JOINED_KEY);
  const { t, m } = useT();
  // Hides the strip after the confirmation has been read, without writing a
  // flag: joining already recorded everything that needs recording.
  const [settled, setSettled] = React.useState(false);

  const visible = arrived && !dismissed && !joined && !settled;
  if (!visible) return null;

  return (
    <aside
      aria-label={t(m.waitlist.promptLabel)}
      className="shrink-0 border-b bg-muted/30 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-[var(--duration-surface)] motion-safe:ease-enter"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t(m.waitlist.promptTitle)}</p>
          <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
            {t(m.waitlist.promptBody)}
          </p>
        </div>
        <div className="flex w-full items-start gap-2 sm:w-auto sm:max-w-sm">
          <WaitlistForm
            source="end-of-demo"
            className="min-w-0 flex-1"
            onJoined={() => {
              // Leave the confirmation on screen for a moment, then take the
              // strip away: it has done its job and this is the profile screen.
              setTimeout(() => setSettled(true), 2400);
            }}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => writeLocalFlag(DISMISSED_KEY)}
            aria-label={t(m.waitlist.dismiss)}
            className="mt-0.5 shrink-0 text-muted-foreground"
          >
            <X />
          </Button>
        </div>
      </div>
    </aside>
  );
}
