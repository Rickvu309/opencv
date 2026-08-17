import { Link } from "@/lib/nav";

import { Button } from "@/components/ui/button";
import { messages } from "@/lib/i18n/messages";

const copy = messages.landing;

export function LandingStory() {
  return (
    <div className="flex max-w-3xl flex-col">
      <div className="flex flex-col gap-3">
        <p className="hero-enter text-sm text-muted-foreground">{copy.audience}</p>
        <h1 className="hero-enter type-display text-balance text-foreground delay-[var(--duration-press)]">
          {copy.headline}
        </h1>
        <p className="hero-enter type-display-next text-pretty text-foreground delay-[var(--duration-state)]">
          {copy.headlineNext}
        </p>
      </div>
      <p className="hero-enter type-chat mt-6 max-w-[40ch] text-pretty text-foreground delay-[var(--duration-surface)]">
        {copy.subhead}
      </p>
      <div className="hero-enter mt-10 flex flex-col items-stretch gap-3 delay-[var(--duration-reveal)] sm:flex-row sm:items-center">
        <Button asChild size="lg" className="h-11 px-5">
          <Link href="/sign-up">{copy.createAccount}</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-11 px-5">
          <Link href="/sign-in">{copy.signIn}</Link>
        </Button>
      </div>
    </div>
  );
}
