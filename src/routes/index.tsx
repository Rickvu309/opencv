import { createFileRoute } from "@tanstack/react-router";

import { LandingFooter } from "@/components/landing/footer";
import { LandingHeader } from "@/components/landing/header";
import { LandingStory } from "@/components/landing/story";
import { SkipLink } from "@/components/layout/skip-link";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      <SkipLink />
      <LandingHeader />
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-10 sm:px-8"
      >
        <LandingStory />
      </main>
      <LandingFooter />
    </div>
  );
}
