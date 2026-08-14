"use client";

import Link from "next/link";
import { CoachBox } from "@/components/brand/coach-box";

import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/language-toggle";
import { useT } from "@/lib/i18n/use-t";

const press =
  "active:scale-[0.96] transition-transform duration-[var(--duration-press)] ease-snap motion-reduce:transition-none";

/**
 * Offered before anything is read. Language first, then the two doors: sign in
 * for someone who already has an account, try-it for someone who does not.
 */
export function LandingHeader() {
  const { t, m } = useT();

  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CoachBox size="sm" filled />
          </span>
          <span className="text-sm font-semibold tracking-tight">OpenPath</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <LanguageToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/sign-in">{t(m.auth.signIn)}</Link>
          </Button>
          <Button asChild size="sm" className={press}>
            <Link href="/sign-up">{t(m.landing.tryIt)}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
