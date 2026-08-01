"use client";

import { HeroVisual } from "@/components/marketing/hero-visual";
import { OpenOpenPathButton } from "@/components/marketing/open-openpath-button";
import { Button } from "@/components/ui/button";

function scrollToHowItWorks() {
  const target = document.getElementById("how-it-works");
  if (!target) return;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
}

/**
 * Serial Position (brief section 6): the hero carries the product's whole
 * claim in one sentence, so a visitor who reads nothing else still gets
 * it. The hero visual gets its own considered entrance (a one-time
 * fade-and-rise on mount, `animate-hero-in` in app/globals.css), not a
 * scroll trigger, since there is nothing to scroll past yet.
 */
export function HeroSection() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-6 pt-20 pb-16 text-center lg:pt-28 lg:pb-24">
      <div className="flex flex-col items-center gap-5">
        <h1 className="max-w-3xl text-4xl leading-[1.12] font-semibold tracking-tight text-foreground lg:text-5xl">
          Choose the right opportunities. Prove you fit them. Grow toward the path you want.
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground lg:text-lg">
          OpenPath is an AI-native career workspace, not a tracker and not another chat window.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <OpenOpenPathButton className="h-11 px-6 text-base" />
        <Button variant="ghost" className="h-11 px-6 text-base text-muted-foreground" onClick={scrollToHowItWorks}>
          See how it works
        </Button>
      </div>

      <div className="w-full max-w-2xl animate-hero-in">
        <HeroVisual />
      </div>
    </section>
  );
}
