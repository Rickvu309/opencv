"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Circle } from "lucide-react";

import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAppState } from "@/lib/actions/store";
import { loadConversations } from "@/lib/coach/sessions";
import { useT } from "@/lib/i18n/use-t";
import { checklistComplete, checklistSteps } from "@/lib/onboarding/checklist";
import { cn } from "@/lib/utils";

/**
 * The four first steps, in the help menu.
 *
 * Lives on `?` rather than on the Coach empty state: the conversation is the
 * product, and a lecture under the composer competed with the first question.
 * The list still reads the real store, so a step cannot stay ticked after the
 * work it names has been deleted. It takes itself away once all four are done.
 */
export function ActivationChecklist() {
  const state = useAppState();
  const { t, m } = useT();

  const hasTalked = React.useSyncExternalStore(
    () => () => {},
    () => loadConversations().length > 0,
    () => false,
  );

  const steps = checklistSteps(state, hasTalked);
  if (checklistComplete(steps)) return null;

  return (
    <>
      <DropdownMenuLabel className="font-normal">
        <span className="block text-sm font-medium text-foreground">
          {t(m.onboarding.checklistTitle)}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground whitespace-normal">
          {t(m.onboarding.checklistLead)}
        </span>
      </DropdownMenuLabel>
      {steps.map((step) => (
        <DropdownMenuItem
          key={step.id}
          asChild
          className="items-start whitespace-normal"
        >
          <Link
            href={step.href}
            className={cn(step.done && "text-muted-foreground line-through")}
          >
            {step.done ? (
              <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            ) : (
              <Circle
                className="mt-0.5 size-3.5 shrink-0 opacity-50"
                aria-hidden
              />
            )}
            <span className="min-w-0">{t(step.label)}</span>
          </Link>
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
    </>
  );
}
