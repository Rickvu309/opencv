"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  checkEmail,
  emailProblemMessage,
  type WaitlistErrorCode,
} from "@/lib/waitlist/email";
import { messages } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/use-t";
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
  const { t, m, locale } = useT();
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const errorId = React.useId();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === "sending") return;

    // A courtesy check that saves a round trip. The server runs the same one
    // and it is the server's answer that decides.
    const problem = checkEmail(email);
    if (problem) {
      setError(t(emailProblemMessage(problem)));
      return;
    }

    setState("sending");
    setError(null);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      // The server answers with a stable code, not a sentence: it has no idea
      // which language this browser is reading in, and a server that guesses
      // gets it wrong for exactly the users this feature is for.
      const payload = (await response.json()) as {
        ok: boolean;
        code?: WaitlistErrorCode;
      };
      if (!response.ok || !payload.ok) {
        setState("idle");
        setError(waitlistErrorMessage(payload.code)[locale]);
        return;
      }
      writeLocalFlag(JOINED_KEY);
      setState("done");
      onJoined?.();
    } catch {
      setState("idle");
      setError(t(m.errors.waitlistOffline));
    }
  }

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
    <form onSubmit={submit} className={cn("w-full", className)} noValidate>
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t(m.waitlist.emailPlaceholder)}
          aria-label={t(m.waitlist.emailLabel)}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError(null);
          }}
          autoFocus={autoFocus}
          // 16px on mobile: anything smaller makes iOS Safari zoom the page on
          // focus, which on a landing page reads as the site breaking.
          className="h-11 text-base sm:h-10 md:text-sm"
        />
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
