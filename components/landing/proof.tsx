"use client";

import { useT } from "@/lib/i18n/use-t";

/**
 * One panel, two claims, a hairline between them. Not two floating cards with
 * icons: that is the grid DESIGN.md forbids, and it hid the actual claim.
 */
export function LandingProof() {
  const { t, m } = useT();

  return (
    <section className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <h2 className="text-sm font-medium text-muted-foreground">
        {t(m.landing.pillarsHeading)}
      </h2>
      <div className="mt-4 overflow-hidden rounded-xl border bg-card">
        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="p-5">
            <p className="text-sm font-medium">{t(m.landing.pillar1Title)}</p>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              {t(m.landing.pillar1Body)}
            </p>
          </div>
          <div className="p-5">
            <p className="text-sm font-medium">{t(m.landing.pillar2Title)}</p>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              {t(m.landing.pillar2Body)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
