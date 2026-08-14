"use client";

import { LandingFooter } from "@/components/landing/footer";
import { LandingHeader } from "@/components/landing/header";
import { LandingHero } from "@/components/landing/hero";
import { LandingHow } from "@/components/landing/how";
import { LandingProof } from "@/components/landing/proof";

/**
 * The page has to do one thing: make a student understand, in the two sentences
 * they will give it, what this is and why it is different from the six career
 * sites they have already closed.
 *
 * ## What is deliberately not here
 *
 * No testimonials, no "10,000 students", no logos of companies nobody placed
 * anyone at. The product's first principle is evidence over encouragement, and
 * a landing page that opens with an invented number has broken that promise
 * before the visitor has signed up. What is here instead is the specific,
 * checkable claim: the Coach edits your work, and you can undo it — shown as
 * a conversation, not as a grey sentence under a card grid.
 */
export default function Home() {
  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <LandingHeader />
      <main className="flex flex-1 flex-col gap-16 pb-10 lg:gap-20">
        <LandingHero />
        <LandingProof />
        <LandingHow />
      </main>
      <LandingFooter />
    </div>
  );
}
