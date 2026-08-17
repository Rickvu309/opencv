import { Link } from "@/lib/nav";

import { messages } from "@/lib/i18n/messages";

const copy = messages.landing;
const year = new Date().getFullYear();

export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
        <Link
          href="/"
          className="w-fit text-sm font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          OpenPath
        </Link>
        <p className="text-sm text-muted-foreground">
          {year}. {copy.footerNote}
        </p>
      </div>
    </footer>
  );
}
