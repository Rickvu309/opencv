import { LandingFooter } from "@/components/landing/footer";
import { LandingHeader } from "@/components/landing/header";
import { LandingStory } from "@/components/landing/story";
import { SkipLink } from "@/components/skip-link";

/**
 * Discover. English only on this pass. One shared column: header, story,
 * footer on the same leading edge. The story starts from the top.
 */
export default function Home() {
  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <SkipLink />
      <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-1 flex-col px-5 sm:px-8 lg:px-12">
        <LandingHeader />
        <main id="main-content" className="flex flex-1 flex-col pt-12 sm:pt-16 lg:pt-20">
          <LandingStory />
        </main>
        <LandingFooter />
      </div>
    </div>
  );
}
