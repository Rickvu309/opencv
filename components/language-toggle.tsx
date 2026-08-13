"use client";

import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDispatch } from "@/lib/actions/store";
import { localeNames, locales } from "@/lib/i18n/locale";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

/**
 * The language switcher, for surfaces outside the app shell.
 *
 * Inside the app it lives in the account menu, where a setting belongs. On the
 * landing page and in onboarding there is no account menu yet, and those are
 * the two screens where a reader who does not read Vietnamese most needs to
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
        "inline-flex items-center gap-0.5 rounded-lg border bg-card p-0.5",
        className,
      )}
    >
      <Languages
        aria-hidden
        className="ml-1.5 size-3.5 shrink-0 text-muted-foreground"
      />
      {locales.map((code) => (
        <Button
          key={code}
          type="button"
          size="sm"
          variant={locale === code ? "secondary" : "ghost"}
          aria-pressed={locale === code}
          onClick={() =>
            dispatch("settings.setLanguage", { language: code }, { silent: true })
          }
          className="h-7 px-2 text-xs font-normal"
        >
          {localeNames[code]}
        </Button>
      ))}
    </div>
  );
}
