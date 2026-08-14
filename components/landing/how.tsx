"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

const press =
  "active:scale-[0.96] transition-transform duration-[var(--duration-press)] ease-snap motion-reduce:transition-none";

/**
 * Three steps because it is a sequence, not because landing pages number
 * things. The control note sits under them: an agent that edits is only
 * acceptable if you can see it and take it back.
 */
export function LandingHow() {
  const { t, m } = useT();
  const steps = [t(m.landing.how1), t(m.landing.how2), t(m.landing.how3)];

  return (
    <section className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <h2 className="text-sm font-medium text-muted-foreground">
        {t(m.landing.howHeading)}
      </h2>
      <ol className="mt-4 grid overflow-hidden rounded-xl border bg-card divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {steps.map((step, index) => (
          <li key={step} className="p-5">
            <span className="text-xs tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            <p className="mt-1 text-sm text-pretty">{step}</p>
          </li>
        ))}
      </ol>
      <p className="mt-5 max-w-2xl text-sm text-muted-foreground text-pretty">
        {t(m.landing.controlNote)}
      </p>
      <div className="mt-8">
        <Button asChild size="lg" className={cn("h-11 px-5", press)}>
          <Link href="/sign-up">
            {t(m.landing.tryIt)}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
