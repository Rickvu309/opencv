"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { useT } from "@/lib/i18n/use-t";

export function LandingFooter() {
  const { t, m } = useT();

  return (
    <footer className="mx-auto mt-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <p className="text-xs text-muted-foreground text-pretty">
        {t(m.landing.footerPrivacy)}
      </p>
      <LanguageToggle />
    </footer>
  );
}
