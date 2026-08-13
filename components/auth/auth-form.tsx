"use client";

import * as React from "react";
import Link from "next/link";
import { Route } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { authProblem, type ProblemField } from "@/lib/auth/problems";
import { useT } from "@/lib/i18n/use-t";

/**
 * The front door, in both of its two moods.
 *
 * One component for signing in and creating an account, because the two forms
 * are the same two fields and the same submit, and keeping them apart meant
 * keeping two copies of the error handling, the disabled state and the focus
 * order in step. What differs is the endpoint, the words, and one rule: a new
 * account gets its errors beside the field that caused them, and a sign-in
 * never does.
 *
 * ## Why a full page rather than a dialog
 *
 * This is where somebody arrives from a link, from a redirect after their
 * session expired, and from the landing page. All three want a URL. A dialog
 * has none, and the redirect in `proxy.ts` has to send them somewhere.
 */
export function AuthForm({ mode, next }: { mode: "sign-in" | "sign-up"; next?: string }) {
  const { t, m, locale } = useT();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<{ field: ProblemField; text: string } | null>(null);

  const usernameError = React.useId();
  const passwordError = React.useId();
  const formError = React.useId();

  const creating = mode === "sign-up";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // The locale goes with the sign-up so the new account's plan stages are
        // labelled in the language this person is reading right now. From then
        // on those labels are their text, not ours.
        body: JSON.stringify(
          creating ? { username, password, locale } : { username, password },
        ),
      });
      const payload = (await response.json()) as { ok: boolean; code?: string };

      if (!response.ok || !payload.ok) {
        const { field, message } = authProblem(payload.code);
        setProblem({ field, text: message[locale] });
        setBusy(false);
        return;
      }

      // A hard navigation rather than a client push: the root layout reads the
      // account's state on the server, and it has to run again now that there
      // is an account to read it for.
      window.location.assign(next && next.startsWith("/") ? next : "/onboarding");
    } catch {
      const { message } = authProblem("offline");
      setProblem({ field: "form", text: message[locale] });
      setBusy(false);
    }
  }

  const problemFor = (field: ProblemField) =>
    problem?.field === field ? problem.text : null;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Route className="size-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">OpenPath</span>
        </Link>

        <h1 className="mt-8 text-xl font-semibold tracking-tight">
          {t(creating ? m.auth.signUpTitle : m.auth.signInTitle)}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t(creating ? m.auth.signUpLead : m.auth.signInLead)}
        </p>

        <form className="mt-8 space-y-4" onSubmit={submit} noValidate>
          <Field
            id="username"
            label={t(m.auth.username)}
            error={problemFor("username")}
            errorId={usernameError}
          >
            <Input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                if (problem) setProblem(null);
              }}
              aria-invalid={problemFor("username") !== null}
              aria-describedby={problemFor("username") ? usernameError : undefined}
              autoFocus
              // 16px on mobile: anything smaller makes iOS Safari zoom the page
              // on focus, which on a first screen reads as the site breaking.
              className="h-11 text-base sm:h-10 md:text-sm"
            />
          </Field>

          <Field
            id="password"
            label={t(m.auth.password)}
            error={problemFor("password")}
            errorId={passwordError}
            hint={creating ? t(m.auth.passwordHint) : undefined}
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={creating ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (problem) setProblem(null);
              }}
              aria-invalid={problemFor("password") !== null}
              aria-describedby={problemFor("password") ? passwordError : undefined}
              className="h-11 text-base sm:h-10 md:text-sm"
            />
          </Field>

          {/* Above the button, not below it: an error under a submit control is
              the one place a screen reader reaches last and a thumb covers. */}
          {problemFor("form") && (
            <p id={formError} role="alert" className="text-sm text-destructive">
              {problemFor("form")}
            </p>
          )}

          <Button type="submit" disabled={busy} className="h-11 w-full sm:h-10">
            {busy && <Spinner />}
            {t(
              creating
                ? busy
                  ? m.auth.signingUp
                  : m.auth.signUp
                : busy
                  ? m.auth.signingIn
                  : m.auth.signIn,
            )}
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          {t(creating ? m.auth.haveAccount : m.auth.noAccountYet)}{" "}
          <Link
            href={creating ? "/sign-in" : "/sign-up"}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {t(creating ? m.auth.signIn : m.auth.signUp)}
          </Link>
        </p>

        {creating && (
          <p className="mt-6 rounded-lg border bg-muted/40 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
            {t(m.auth.forgotNote)}
          </p>
        )}
      </div>
    </main>
  );
}

/** Label, control, and the error that belongs to it, in that order. */
function Field({
  id,
  label,
  hint,
  error,
  errorId,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error: string | null;
  errorId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {/* Inline and next to the field that failed, never a toast: an error the
          user has to act on should not be able to disappear on its own. */}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
