"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Circle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAppState } from "@/lib/actions/store";
import { loadConversations } from "@/lib/coach/sessions";
import { useT } from "@/lib/i18n/use-t";
import { checklistComplete, checklistSteps } from "@/lib/onboarding/checklist";
import { cn } from "@/lib/utils";
import { useLocalFlag, writeLocalFlag } from "@/lib/waitlist/use-local-flag";

/**
 * The four first steps, on the screen the user lands on after onboarding.
 *
 * ## Why the dismissal is in the browser and not in `AppState`
 *
 * `AppState` is the store the Coach can read and change. "I have hidden a
 * panel" is not something the Coach has any business seeing, let alone
 * undoing, and putting it there would also mean an action, a migration and a
 * field in the turn context for the sake of one boolean. It is a preference
 * about this browser, so it lives where preferences about this browser live.
 *
 * The cost is that dismissing it on a laptop leaves it showing on a phone.
 * Acceptable: the list takes itself away once the four steps are done, which is
 * the normal way it ends.
 */
const DISMISSED_KEY = "openpath.checklist.dismissed";

export function ActivationChecklist() {
  const state = useAppState();
  const { t, m } = useT();
  // `useSyncExternalStore` under the hood, so the server renders "not
  // dismissed" and the client corrects it without a state write in an effect.
  // Same hook the waiting list uses for the same question.
  const dismissed = useLocalFlag(DISMISSED_KEY);

  // Conversations are read once on mount. They cannot change while this panel
  // is on screen: it renders only on the empty state, and the first message
  // sent takes the thread out of it.
  const hasTalked = React.useSyncExternalStore(
    () => () => {},
    () => loadConversations().length > 0,
    () => false,
  );

  const steps = checklistSteps(state, hasTalked);
  if (dismissed || checklistComplete(steps)) return null;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{t(m.onboarding.checklistTitle)}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t(m.onboarding.checklistLead)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t(m.onboarding.checklistDismiss)}
          className="text-muted-foreground"
          onClick={() => writeLocalFlag(DISMISSED_KEY)}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <ul className="mt-3 space-y-1.5">
        {steps.map((step) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className={cn(
                "flex items-baseline gap-2 text-sm",
                step.done
                  ? "text-muted-foreground line-through"
                  : "underline-offset-4 hover:underline",
              )}
            >
              {step.done ? (
                <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              ) : (
                <Circle className="mt-0.5 size-3.5 shrink-0 opacity-50" aria-hidden />
              )}
              <span className="min-w-0">{t(step.label)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
