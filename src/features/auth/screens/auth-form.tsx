import { useState, type FormEvent } from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Checkbox } from "@/ui/checkbox";
import { Loader } from "@/ui/loader";
import { Mark } from "@/ui/mark";
import { Card } from "@/ui/card";
import { cn } from "@/lib/utils";

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string; field?: "email" };

export function AuthForm({
  mode,
  onSuccess,
  onSubmit,
}: {
  mode: "sign-in" | "sign-up";
  onSuccess: () => void | Promise<void>;
  onSubmit: (creds: {
    email: string;
    password: string;
    remember: boolean;
  }) => Promise<AuthResult>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(true);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const signUp = mode === "sign-up";

  function validate() {
    let ok = true;
    setEmailError("");
    setPasswordError("");
    setConfirmError("");
    setFormError("");
    if (!email.trim() || !email.includes("@")) {
      setEmailError("Enter an email.");
      ok = false;
    }
    if (password.length < 8) {
      setPasswordError("Use at least 8 characters.");
      ok = false;
    } else if (signUp && confirm !== password) {
      setConfirmError("Passwords must match.");
      ok = false;
    }
    return ok;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || pending) return;
    setPending(true);
    try {
      const result = await onSubmit({
        email,
        password,
        remember: signUp ? true : remember,
      });
      if (!result.ok) {
        if (result.field === "email") setEmailError(result.error);
        else setFormError(result.error);
        return;
      }
      await onSuccess();
    } catch {
      setFormError(
        signUp ? "Couldn't create the account. Try again." : "Couldn't sign in. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  const emailField = (
    <div>
      <Label htmlFor="email">Email</Label>
      <Input
        id="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        aria-invalid={emailError ? true : undefined}
        aria-describedby={emailError ? "email-error" : undefined}
      />
      {emailError ? (
        <p id="email-error" className="mt-1 text-[13px] text-destructive">
          {emailError}
        </p>
      ) : null}
    </div>
  );

  const passwordField = (
    <div>
      <Label htmlFor="password">Password</Label>
      <Input
        id="password"
        type="password"
        autoComplete={signUp ? "new-password" : "current-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
        aria-invalid={passwordError ? true : undefined}
        aria-describedby={
          passwordError ? "password-error" : signUp ? "password-hint" : undefined
        }
      />
      {passwordError ? (
        <p id="password-error" className="mt-1 text-[13px] text-destructive">
          {passwordError}
        </p>
      ) : null}
    </div>
  );

  const confirmField = (
    <div>
      <Label htmlFor="confirm-password">Confirm password</Label>
      <Input
        id="confirm-password"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        minLength={8}
        aria-invalid={confirmError ? true : undefined}
        aria-describedby={confirmError ? "confirm-password-error" : undefined}
      />
      {confirmError ? (
        <p id="confirm-password-error" className="mt-1 text-[13px] text-destructive">
          {confirmError}
        </p>
      ) : null}
    </div>
  );

  const submitButton = (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader label={signUp ? "Creating account" : "Signing in"} /> : null}
      {signUp ? "Create account" : "Sign in"}
    </Button>
  );

  const formErrorLine = formError ? (
    <p className="text-[13px] text-destructive" role="alert">
      {formError}
    </p>
  ) : null;

  const fields = signUp ? (
    <>
      {emailField}
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {passwordField}
          {confirmField}
        </div>
        {passwordError ? null : (
          <p id="password-hint" className="text-[13px] text-ink-muted">
            Use at least 8 characters.
          </p>
        )}
      </div>
    </>
  ) : (
    <>
      {emailField}
      {passwordField}
      <label className="flex min-h-[var(--size-touch)] items-center gap-2 text-[13px]">
        <Checkbox
          id="remember"
          checked={remember}
          onCheckedChange={(value) => setRemember(value === true)}
          aria-label="Keep me signed in"
        />
        Keep me signed in
      </label>
    </>
  );

  return (
    <main
      id="main"
      className="flex min-h-svh flex-col items-center justify-center bg-canvas p-6 md:p-10"
    >
      <div className="w-full max-w-sm md:max-w-4xl">
        <Card className="overflow-hidden p-0">
          <div className="grid min-h-[36rem] md:grid-cols-2">
            <form className="flex flex-col justify-center gap-6 p-6 md:p-8" onSubmit={(e) => void submit(e)} noValidate>
              <div className="flex flex-col items-center gap-2 text-center">
                <a href="/" className="flex items-center gap-2 text-[13px] font-[510] text-ink">
                  <Mark className="size-5" />
                  OpenPath
                </a>
                <h1 className="text-balance mt-2 text-[24px] font-[590] leading-[1.3] tracking-[-0.017em]">
                  {signUp ? "Create an account" : "Sign in"}
                </h1>
              </div>
              {fields}
              {formErrorLine}
              {submitButton}
              <p className="text-center text-[13px] text-ink-muted">
                {signUp ? (
                  <>
                    Already have an account?{" "}
                    <a href="/sign-in" className="text-accent underline-offset-2 hover:underline">
                      Sign in
                    </a>
                  </>
                ) : (
                  <>
                    New here?{" "}
                    <a href="/sign-up" className="text-accent underline-offset-2 hover:underline">
                      Create an account
                    </a>
                  </>
                )}
              </p>
            </form>
            <AuthPanel />
          </div>
        </Card>
      </div>
    </main>
  );
}

function AuthPanel() {
  return (
    <div
      aria-hidden="true"
      className="relative hidden overflow-hidden bg-surface-2 md:block"
    >
      <div
        className={cn(
          "absolute inset-0 bg-[size:48px_48px] opacity-80",
          "bg-[linear-gradient(to_right,var(--hairline)_1px,transparent_1px),linear-gradient(to_bottom,var(--hairline)_1px,transparent_1px)]",
          "[mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]",
        )}
      />
      <div className="relative flex h-full items-center justify-center text-ink">
        <Mark className="size-12" />
      </div>
    </div>
  );
}
