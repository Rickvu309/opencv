"use client";

import { Link } from "@/lib/nav";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";
import { CoachMark } from "./thread-view";

/**
 * What the Coach shows when the session is over.
 *
 * This is where the demo's sign-in form used to be, with a shared password
 * printed under it. There is nothing to type here now: the door is the app's
 * own sign-in page, and signing in there brings the whole product back rather
 * than only the chat. So this states what happened and points at it.
 *
 * `next` sends them to `/coach` afterwards, which is the screen they were on,
 * and is what makes this a pause rather than a place they lose their thread.
 */
export function CoachSessionEnded({ compact }: { compact?: boolean }) {
  const { t, m } = useT();

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-sm flex-col justify-center",
        compact ? "px-4 py-6" : "px-5 py-10 sm:px-8",
      )}
    >
      <CoachMark />
      <h1
        className={cn(
          "mt-4 font-semibold tracking-tight",
          compact ? "text-base" : "text-lg",
        )}
      >
        {t(m.coach.sessionEndedTitle)}
      </h1>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
        {t(m.coach.sessionEndedBody)}
      </p>

      <Button asChild className="mt-6 w-full">
        <Link href="/sign-in?next=%2Fcoach">{t(m.auth.signIn)}</Link>
      </Button>
    </div>
  );
}
