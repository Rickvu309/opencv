"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";
import { CoachMark } from "./thread-view";

/**
 * The credential this demo runs on, shown rather than hidden.
 *
 * These are in the client bundle, and that is unavoidable rather than sloppy:
 * the ticket asks for the credential to be printed on the form, and anything
 * printed on a form is in the bundle. The two requirements cannot both hold,
 * and printing it wins, because a shared demo whose password you have to ask
 * for is a demo nobody sees.
 *
 * So be clear about what this password is for. It is not a secret: it stops
 * drive-by traffic from burning model tokens on an open endpoint, nothing more.
 * The credential that does matter, `NVIDIA_API_KEY`, is server-side only and
 * verified absent from both bundles. Changing this one means a redeploy, and it
 * must never be reused anywhere it would protect something real.
 */
const DEMO_USER = "hello@openpath.app";
const DEMO_PASSWORD = "Demo12345";

/**
 * The Coach's front door.
 *
 * Shown in place of the thread when the agent answers 401. Deliberately prints
 * the credential it wants: this is a shared demo account, so hiding the key
 * would add friction without adding protection, and a visitor who has to email
 * someone for a password never sees the product.
 *
 * The rest of the app stays open. Only the Coach costs model tokens, so only
 * the Coach is worth a door.
 */
export function CoachSignIn({
  onSubmit,
  busy,
  error,
  compact,
}: {
  onSubmit: (username: string, password: string) => void;
  busy: boolean;
  error: string | null;
  compact?: boolean;
}) {
  const { t, m } = useT();
  const [username, setUsername] = React.useState(DEMO_USER);
  const [password, setPassword] = React.useState("");
  const errorId = React.useId();

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-sm flex-col justify-center",
        compact ? "px-4 py-6" : "px-5 py-10 sm:px-8",
      )}
    >
      <CoachMark />
      <h1 className={cn("mt-4 font-semibold tracking-tight", compact ? "text-base" : "text-lg")}>
        {t(m.coach.signInTitle)}
      </h1>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
        {t(m.coach.signInBody)}
      </p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) onSubmit(username.trim(), password);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="coach-user">{t(m.coach.email)}</Label>
          <Input
            id="coach-user"
            name="username"
            type="email"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="h-10 text-base md:text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="coach-password">{t(m.coach.password)}</Label>
          <Input
            id="coach-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            className="h-10 text-base md:text-sm"
            autoFocus
          />
          {/* Inline and next to the field that failed, not a toast: an error the
              user has to act on should not be able to disappear on its own. */}
          {error && (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <Button type="submit" disabled={busy} className="w-full">
          {busy && <Spinner />}
          {t(busy ? m.coach.signingIn : m.coach.signIn)}
        </Button>
      </form>

      <p className="mt-6 rounded-lg border bg-muted/40 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
        {t(m.coach.demoAccount)}
        <br />
        <span className="text-foreground select-all">{DEMO_USER}</span>
        <br />
        <span className="text-foreground select-all">{DEMO_PASSWORD}</span>
      </p>
    </div>
  );
}
