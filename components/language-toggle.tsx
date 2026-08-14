"use client";

import { Button } from "@/components/ui/button";
import { useDispatch } from "@/lib/actions/store";
import { localeNames, locales } from "@/lib/i18n/locale";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

/**
 * The language switcher, for surfaces outside the app shell.
 *
 * Inside the app it lives in the help menu (`?`), one tap from every screen.
 * On the landing page and in onboarding there is no help button yet, and those
 * are the two screens where a reader who does not read Vietnamese most needs to
 * find it: one is the first thing they see, the other asks them to type.
 *
 * A segmented pair rather than a dropdown, because there are exactly two and
 * both fit. Each names itself in its own language.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const dispatch = useDispatch();
  const { t, m, locale } = useT();

  return (
    <div
      role="group"
      aria-label={t(m.common.language)}
      className={cn(
        "inline-flex items-center rounded-md border bg-card p-px",
        className,
      )}
    >
      {locales.map((code) => (
        <Button
          key={code}
          type="button"
          size="xs"
          variant={locale === code ? "secondary" : "ghost"}
          aria-pressed={locale === code}
          onClick={() =>
            dispatch("settings.setLanguage", { language: code }, { silent: true })
          }
          className="px-1.5 font-normal"
        >
          {localeNames[code]}
        </Button>
      ))}
    </div>
  );
}
