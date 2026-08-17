"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { useForm } from "@tanstack/react-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  checkEmail,
  emailProblemMessage,
  type WaitlistErrorCode,
} from "@/lib/waitlist/email";
import { messages } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/use-t";
import { useJoinWaitlist } from "@/lib/query/satellite";
import {
  readLocalFlag,
  useLocalFlag,
  writeLocalFlag,
} from "@/lib/waitlist/use-local-flag";

export const JOINED_KEY = "openpath:waitlist-joined:v1";

/** The API's stable failure codes, mapped to something a person can act on. */
function waitlistErrorMessage(code: WaitlistErrorCode | undefined) {
  switch (code) {
    case "email-empty":
      return messages.errors.waitlistEmailEmpty;
    case "email-shape":
      return messages.errors.waitlistEmailShape;
    case "email-too-long":
      return messages.errors.waitlistEmailTooLong;
    case "bad-request":
      return messages.errors.waitlistBadRequest;
    case "rate-limited":
      return messages.errors.waitlistRateLimited;
    default:
      return messages.errors.waitlistStoreDown;
  }
}

/** Has this browser already joined? Used to avoid asking the same person twice. */
export function useHasJoinedWaitlist(): boolean {
  return useLocalFlag(JOINED_KEY);
}

/** The same question outside React, for code that only needs it once. */
export function hasJoinedWaitlist(): boolean {
  return readLocalFlag(JOINED_KEY);
}

/**
 * One email field and one button.
 *
 * Used in two places with different copy around it: on the landing page, where
 * the ask is cold, and at the end of the demo, where the product has already
 * proved something. The form is the same because the list is the same.
 */
export function WaitlistForm({
  source,
  onJoined,
  className,
  autoFocus,
}: {
  source: "landing" | "end-of-demo";
  onJoined?: () => void;
  className?: string;
  autoFocus?: boolean;
}) {
  const { t, m } = useT();
  const join = useJoinWaitlist();
  const [state, setState] = React.useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const errorId = React.useId();
  const inputId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      if (state === "sending") return;
      const problem = checkEmail(value.email);
      if (problem) {
        setError(t(emailProblemMessage(problem)));
        inputRef.current?.focus();
        return;
      }
      setState("sending");
      setError(null);
      try {
        const payload = await join.mutateAsync({
          email: value.email,
          source,
        });
        if (!payload.ok) {
          setState("idle");
          setError(t(waitlistErrorMessage(payload.code)));
          inputRef.current?.focus();
          return;
        }
        writeLocalFlag(JOINED_KEY);
        setState("done");
        onJoined?.();
      } catch {
        setState("idle");
        setError(t(m.errors.waitlistOffline));
        inputRef.current?.focus();
      }
    },
  });

  if (state === "done") {
    return (
      <p
        role="status"
        className={cn(
          "flex items-center justify-center gap-2 text-sm text-muted-foreground",
          className,
        )}
      >
        <Check className="size-4 shrink-0 text-success" />
        {t(m.waitlist.joined)}
      </p>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      className={cn("w-full", className)}
      noValidate
    >
      <Label htmlFor={inputId} className="mb-2">
        {t(m.waitlist.emailLabel)}
      </Label>
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <form.Field name="email">
          {(field) => (
            <Input
              ref={inputRef}
              id={inputId}
              type="email"
              name={field.name}
              inputMode="email"
              autoComplete="email"
              placeholder={t(m.waitlist.emailPlaceholder)}
              aria-invalid={error !== null}
              aria-describedby={error ? errorId : undefined}
              value={field.state.value}
              onChange={(event) => {
                field.handleChange(event.target.value);
                if (error) setError(null);
              }}
              autoFocus={autoFocus}
              className="h-11 text-base sm:h-10 md:text-sm"
            />
          )}
        </form.Field>
        <Button
          type="submit"
          size="lg"
          disabled={state === "sending"}
          className="h-11 shrink-0 px-5 sm:h-10"
        >
          {state === "sending" && <Spinner />}
          {t(state === "sending" ? m.waitlist.joining : m.waitlist.join)}
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
