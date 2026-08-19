import { ArrowUp } from "lucide-react";
import { useState, type FormEvent } from "react";
import { buttonAttrs, Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Loader } from "@/ui/loader";
import { Mark } from "@/ui/mark";
import { cn } from "@/lib/utils";

export interface LandingWaitlistProps {
  email: string;
  emailError: string;
  joined: boolean;
  pending: boolean;
  onEmail: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
}

export function LandingPage({
  waitlist,
  onComposerSend,
}: {
  waitlist: LandingWaitlistProps;
  onComposerSend: () => void;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <header className="sticky top-0 z-[var(--z-sticky)] border-b border-hairline bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <a href="/" className="flex items-center gap-2 text-[15px] font-[590] text-ink">
            <Mark className="size-5" />
            OpenPath
          </a>
          <nav className="flex items-center gap-2" aria-label="Account">
            <a href="/sign-in" {...buttonAttrs({ variant: "outline", className: "border-ink" })}>
              Sign in
            </a>
            <a href="/sign-up" {...buttonAttrs()}>
              Start now
            </a>
          </nav>
        </div>
      </header>

      <main id="main" className="relative flex-1">
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-[28rem]",
            "bg-[size:48px_48px]",
            "bg-[linear-gradient(to_right,var(--hairline)_1px,transparent_1px),linear-gradient(to_bottom,var(--hairline)_1px,transparent_1px)]",
            "[mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]",
            "opacity-80",
          )}
        />

        <section className="relative mx-auto max-w-4xl px-4 pt-16 pb-16 text-center sm:pt-24">
          <p className="text-[13px] font-[510] text-ink-muted">For students and new graduates</p>
          <h1 className="text-balance mx-auto mt-4 max-w-[18ch] text-[clamp(2rem,1.2rem+3vw,4rem)] font-[590] leading-[1.3] tracking-[-0.028em]">
            Build your CV and find openings that fit
          </h1>

          <LandingComposer onSend={onComposerSend} />

          <nav
            aria-label="Account"
            className="mx-auto mt-8 inline-flex rounded-[var(--radius-container)] border border-hairline bg-surface-2 p-1.5"
          >
            <a
              href="/sign-in"
              className="inline-flex h-10 min-w-28 items-center justify-center rounded-[var(--radius-control)] px-4 text-[13px] font-[510] text-ink-muted hover:bg-surface-3 hover:text-ink"
            >
              Sign in
            </a>
            <a
              href="/sign-up"
              className="inline-flex h-10 min-w-28 items-center justify-center rounded-[var(--radius-control)] bg-accent px-4 text-[13px] font-[510] text-on-accent hover:bg-accent-hover"
            >
              Sign up
            </a>
          </nav>
        </section>

        <section id="waitlist" className="mx-auto w-full max-w-4xl scroll-mt-20 px-4 pb-20">
          <WaitlistBar waitlist={waitlist} />
        </section>
      </main>

      <footer className="border-t border-hairline px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-[13px] text-ink-muted">
          <a href="/" className="flex items-center gap-2 font-[590] text-ink">
            <Mark className="size-5" />
            OpenPath
          </a>
          <p>© {new Date().getFullYear()} OpenPath</p>
          <nav className="flex gap-4" aria-label="Footer">
            <a href="/sign-in" className="underline-offset-2 hover:underline">
              Sign in
            </a>
            <a href="/sign-up" className="underline-offset-2 hover:underline">
              Start now
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function LandingComposer({ onSend }: { onSend: () => void }) {
  const [draft, setDraft] = useState("");
  const empty = !draft.trim();

  return (
    <form
      data-slot="landing-composer"
      className="mx-auto mt-8 flex h-10 w-full max-w-[50rem] items-center rounded-full border border-hairline bg-surface-1 py-1.5 ps-4 pe-1.5 text-left shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
      onSubmit={(e) => {
        e.preventDefault();
        if (empty) return;
        onSend();
      }}
    >
      <label htmlFor="landing-composer" className="sr-only">
        Write to the Coach
      </label>
      <input
        id="landing-composer"
        type="text"
        value={draft}
        placeholder="Write to the Coach"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-[15px] leading-[1.5] text-ink outline-none placeholder:text-ink-muted focus-visible:!shadow-none"
        onChange={(e) => setDraft(e.target.value)}
      />
      <button
        type="submit"
        disabled={empty}
        aria-label="Start now"
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] enabled:active:scale-[0.97]",
          empty
            ? "bg-surface-3 text-ink-muted"
            : "bg-accent text-on-accent hover:bg-accent-hover",
        )}
      >
        <ArrowUp className="size-3.5" aria-hidden="true" />
      </button>
    </form>
  );
}

function WaitlistBar({ waitlist }: { waitlist: LandingWaitlistProps }) {
  const describedBy = waitlist.emailError
    ? "waitlist-error"
    : waitlist.joined
      ? "waitlist-status"
      : undefined;

  return (
    <form className="mx-auto w-full max-w-xl text-left" onSubmit={waitlist.onSubmit} noValidate>
      <h2 className="text-center text-[18px] font-[510] leading-[1.4] tracking-[-0.012em] text-ink">
        Leave your email
      </h2>
      <p className="mt-2 text-center text-[15px] leading-[1.6] text-ink-muted">
        If you are not starting now, we will write when there is news.
      </p>
      <div className="mt-6 flex items-center gap-2 rounded-[var(--radius-container)] border border-hairline bg-surface-1 p-1.5">
        <label htmlFor="waitlist-email" className="sr-only">
          Email
        </label>
        <Input
          id="waitlist-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={waitlist.email}
          onChange={(e) => waitlist.onEmail(e.target.value)}
          placeholder="you@email.com"
          disabled={waitlist.pending || waitlist.joined}
          aria-invalid={waitlist.emailError ? true : undefined}
          aria-describedby={describedBy}
          className="min-h-10 border-0 bg-transparent focus-visible:border-transparent focus-visible:!shadow-none"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={waitlist.pending || waitlist.joined}
        >
          {waitlist.pending ? <Loader label="Joining" /> : null}
          Join
        </Button>
      </div>
      {waitlist.emailError ? (
        <p id="waitlist-error" className="mt-2 text-center text-[13px] text-destructive">
          {waitlist.emailError}
        </p>
      ) : null}
      {waitlist.joined ? (
        <p id="waitlist-status" className="mt-2 text-center text-[13px] text-ink" role="status">
          You&apos;re on the list. We&apos;ll email you.
        </p>
      ) : null}
    </form>
  );
}
