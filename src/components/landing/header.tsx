import { Link } from "@/lib/nav";

import { CoachBox } from "@/components/brand/coach-box";
import { Button } from "@/components/ui/button";
import { messages } from "@/lib/i18n/messages";

const copy = messages.landing;

export function LandingHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center px-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <CoachBox size="sm" />
          <span className="text-sm font-semibold tracking-tight">OpenPath</span>
        </Link>

        <nav className="ms-auto flex items-center" aria-label="Account">
          <Button asChild variant="ghost" size="sm" className="h-10 px-3 sm:h-8">
            <Link href="/sign-in">{copy.signIn}</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
