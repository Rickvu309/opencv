import Link from "next/link";

import { CoachBox } from "@/components/brand/coach-box";
import { Button } from "@/components/ui/button";
import { messages } from "@/lib/i18n/messages";

/**
 * Quiet chrome on the same column as the story. English only on this pass.
 */
export function LandingHeader() {
  return (
    <header className="pt-4">
      <div className="flex h-14 items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CoachBox size="sm" filled />
          </span>
          <span className="text-sm font-semibold tracking-tight">OpenPath</span>
        </Link>

        <div className="ms-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">{messages.auth.signIn}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
