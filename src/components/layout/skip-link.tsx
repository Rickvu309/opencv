"use client";

import { useT } from "@/lib/i18n/use-t";

/** The page's first focusable element: jump past the rail to the content. */
export function SkipLink() {
  const { t, m } = useT();

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:border focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:ring-3 focus:ring-ring/50"
    >
      {t(m.common.skipToContent)}
    </a>
  );
}
