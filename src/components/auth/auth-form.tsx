"use client";

import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { Link } from "@/lib/nav";
import { SkipLink } from "@/components/layout/skip-link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { afterAuthPath } from "@/lib/auth/after-auth";
import { authProblem, type ProblemField } from "@/lib/auth/problems";
import { useT } from "@/lib/i18n/use-t";
import { useAuthSession } from "@/lib/query/satellite";

/**
 * The front door, in both of its two moods.
 *
 * One component for signing in and creating an account, because the two forms
 * share the email, the password, the submit, and the error handling. What
 * differs is the endpoint, the words, and one extra field: a new account asks
 * them to type the password again.
 *
 * ## Why a full page rather than a dialog
 *
 * This is where somebody arrives from a link, from a redirect after their
 * session expired, and from the landing page. All three want a URL. A dialog
 * has none, and the gate in `start.ts` has to send them somewhere.
 */
export function AuthForm({ mode, next }: { mode: "sign-in" | "sign-up"; next?: string }) {
  const { t, m } = useT();
  const session = useAuthSession();
  const creating = mode === "sign-up";

  const form = useForm({
    defaultValues: { email: "", password: "", confirmPassword: "", rememberMe: true },
    onSubmit: async ({ value }) => {
      if (busy) return;
      setBusy(true);
      setProblem(null);

      if (creating) {
        if (value.confirmPassword.length === 0) {
          const { field, message } = authProblem("confirm-required");
          setProblem({ field, text: message });
          setBusy(false);
          return;
        }
        if (value.confirmPassword !== value.password) {
          const { field, message } = authProblem("password-mismatch");
          setProblem({ field, text: message });
          setBusy(false);
          return;
        }
      }

      try {
        const payload = await session.mutateAsync({
          mode,
          email: value.email,
          password: value.password,
          rememberMe: value.rememberMe,
          ...(creating ? { confirmPassword: value.confirmPassword } : {}),
        });

        if (!payload.ok) {
          const { field, message } = authProblem(payload.code);
          setProblem({ field, text: message });
          setBusy(false);
          return;
        }

        window.location.assign(
          afterAuthPath({ next, needsOnboarding: payload.needsOnboarding }),
        );
      } catch {
        const { message } = authProblem("offline");
        setProblem({ field: "form", text: message });
        setBusy(false);
      }
    },
  });

  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<{ field: ProblemField; text: string } | null>(null);

  const emailError = React.useId();
  const passwordError = React.useId();
  const confirmError = React.useId();
  const formError = React.useId();

  const problemFor = (field: ProblemField) =>
    problem?.field === field ? problem.text : null;

  return (
    <div className="flex min-h-svh flex-col">
      <SkipLink />
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pt-10 pb-16 sm:px-8"
      >
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="flex w-fit items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <CoachBox size="md" />
          <span className="text-base font-semibold tracking-tight">OpenPath</span>
        </Link>

        <h1 className="mt-8 text-xl font-semibold tracking-tight">
          {t(creating ? m.auth.signUpTitle : m.auth.signInTitle)}
        </h1>
        <p className="mt-1.5 text-sm text-foreground">
          {t(creating ? m.auth.signUpLead : m.auth.signInLead)}
        </p>

        <form
          className="mt-8 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
          noValidate
        >
          <form.Field name="email">
            {(field) => (
              <Field
                id="email"
                label={t(m.auth.email)}
                error={problemFor("email")}
                errorId={emailError}
              >
                <Input
                  id="email"
                  name={field.name}
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={field.state.value}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                    if (problem) setProblem(null);
                  }}
                  aria-invalid={problemFor("email") !== null}
                  aria-describedby={problemFor("email") ? emailError : undefined}
                  autoFocus
                  className="h-11 text-base md:text-sm"
                />
              </Field>
            )}
          </form.Field>

          <form.Field name="password">
            {(field) => (
              <Field
                id="password"
                label={t(m.auth.password)}
                error={problemFor("password")}
                errorId={passwordError}
                hint={creating ? t(m.auth.passwordHint) : undefined}
              >
                <Input
                  id="password"
                  name={field.name}
                  type="password"
                  autoComplete={creating ? "new-password" : "current-password"}
                  value={field.state.value}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                    if (problem) setProblem(null);
                  }}
                  aria-invalid={problemFor("password") !== null}
                  aria-describedby={problemFor("password") ? passwordError : undefined}
                  className="h-11 text-base md:text-sm"
                />
              </Field>
            )}
          </form.Field>

          {creating && (
            <form.Field name="confirmPassword">
              {(field) => (
                <Field
                  id="confirm-password"
                  label={t(m.auth.confirmPassword)}
                  error={problemFor("confirm")}
                  errorId={confirmError}
                >
                  <Input
                    id="confirm-password"
                    name={field.name}
                    type="password"
                    autoComplete="new-password"
                    value={field.state.value}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      if (problem) setProblem(null);
                    }}
                    aria-invalid={problemFor("confirm") !== null}
                    aria-describedby={problemFor("confirm") ? confirmError : undefined}
                    className="h-11 text-base md:text-sm"
                  />
                </Field>
              )}
            </form.Field>
          )}

          <form.Field name="rememberMe">
            {(field) => (
              <div className="flex min-h-10 items-center gap-2.5">
                <input
                  id="remember-me"
                  name={field.name}
                  type="checkbox"
                  checked={field.state.value}
                  onChange={(event) => field.handleChange(event.target.checked)}
                  className="size-4 shrink-0 rounded-sm border border-border accent-primary"
                />
                <Label htmlFor="remember-me" className="font-normal text-foreground">
                  {t(m.auth.rememberMe)}
                </Label>
              </div>
            )}
          </form.Field>

          {/* Above the button, not below it: an error under a submit control is
              the one place a screen reader reaches last and a thumb covers. */}
          {problemFor("form") && (
            <p id={formError} role="alert" className="text-sm text-destructive">
              {problemFor("form")}
            </p>
          )}

          <Button type="submit" disabled={busy} className="h-11 w-full">
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

        {!creating && (
          <p className="mt-6 text-sm text-foreground">{t(m.auth.forgotNote)}</p>
        )}
      </div>
      </main>
    </div>
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
        <p
          id={errorId}
          role="alert"
          className="field-error-shake text-sm text-destructive motion-reduce:animate-none"
        >
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
