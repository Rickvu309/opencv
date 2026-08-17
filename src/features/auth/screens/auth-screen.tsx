import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { signInFn, signUpFn } from "@/features/auth/server";

export function AuthScreen({ mode }: { mode: "sign-in" | "sign-up" }) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const fn = mode === "sign-up" ? signUpFn : signInFn;
    const result = await fn({ data: { email, password } });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await navigate({ to: "/coach" });
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-[28px] font-medium leading-[1.5]">
        {mode === "sign-up" ? "Create an account" : "Sign in"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {mode === "sign-up"
          ? "Your work stays with you, on every device."
          : "Welcome back. Your papers and conversations are here."}
      </p>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        {error ? <p className="text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full">
          {mode === "sign-up" ? "Create account" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-muted-foreground">
        {mode === "sign-up" ? (
          <>
            Already have an account? <Link to="/sign-in">Sign in</Link>
          </>
        ) : (
          <>
            New here? <Link to="/sign-up">Create an account</Link>
          </>
        )}
      </p>
    </main>
  );
}
