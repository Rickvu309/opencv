import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { joinWaitlistFn } from "@/features/landing/server";

export function LandingScreen() {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  async function onWaitlist(e: FormEvent) {
    e.preventDefault();
    const result = await joinWaitlistFn({ data: { email } });
    setNote(result.ok ? "You're on the list. We'll write when it's useful." : result.error);
  }

  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-16">
      <p className="text-[13px] text-ink-muted">OpenPath</p>
      <h1 className="text-balance mt-4 text-[32px] font-[590] leading-[1.3] tracking-[-0.022em]">
        An AI career coach that does the work with you
      </h1>
      <p className="mt-4 text-pretty text-[15px] leading-[1.6] text-ink-secondary">
        It builds your CV, finds openings that fit, and tells you honestly what is
        missing. You stay in control of every word, and you can undo anything it does.
      </p>
      <p className="mt-6 text-[15px] text-ink-muted">
        For students and new graduates who cannot afford a mentor. You don&apos;t need to
        know your direction yet. That&apos;s the point.
      </p>
      <ol className="mt-10 space-y-3 text-[15px] text-ink-muted">
        <li>1. Prepare yourself: profile, CV, proof of work, pitch.</li>
        <li>2. Find what fits, with the gap named.</li>
        <li>3. Go after it, one application at a time.</li>
      </ol>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link to="/sign-up">
          <Button>Start now</Button>
        </Link>
        <Link to="/sign-in">
          <Button variant="outline">Sign in</Button>
        </Link>
      </div>
      <form className="mt-12 max-w-sm" onSubmit={onWaitlist}>
        <p className="text-[13px]">Not ready to start. Leave your email.</p>
        <div className="mt-2 flex gap-2">
          <label htmlFor="waitlist-email" className="sr-only">
            Email
          </label>
          <Input
            id="waitlist-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.edu"
          />
          <Button type="submit" variant="outline">
            Join
          </Button>
        </div>
        {note ? <p className="mt-2 text-[13px] text-ink-muted">{note}</p> : null}
      </form>
    </main>
  );
}
