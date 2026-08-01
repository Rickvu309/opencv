"use client";

import { useRef } from "react";
import type { ReactNode } from "react";

import { BrowserFrame } from "@/components/marketing/browser-frame";
import { LazyMount } from "@/components/marketing/lazy-mount";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";
import { ShowcaseSkeleton } from "@/components/marketing/showcase-skeleton";
import { useParallax } from "@/components/marketing/use-parallax";
import { cn } from "@/lib/utils";

interface ShowcaseBlockProps {
  eyebrow: string;
  headline: string;
  copy: string;
  address: string;
  contentWidth: number;
  cropHeight: number;
  /** The real, live composition, already wrapped by next/dynamic at the call site so its chunk splits out of the main bundle. */
  visual: ReactNode;
  reverse?: boolean;
}

/**
 * One signature workflow deep-dive (brief section 4): a sharp headline, a
 * 2-line claim, and a framed real-product visual, alternating sides down
 * the page so the section itself doesn't read as a repeating template. The
 * frame gets the subtle parallax drift (brief section 5); the text side
 * gets the plain scroll reveal, staggered a beat behind the frame.
 */
export function ShowcaseBlock({ eyebrow, headline, copy, address, contentWidth, cropHeight, visual, reverse }: ShowcaseBlockProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const offset = useParallax(frameRef);

  return (
    <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
      <ScrollReveal className={cn("flex flex-col gap-3", reverse ? "lg:order-2" : "lg:order-1")}>
        <span className="text-section-label">{eyebrow}</span>
        <h3 className="text-2xl leading-snug font-semibold tracking-tight text-foreground">{headline}</h3>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{copy}</p>
      </ScrollReveal>

      <ScrollReveal delayMs={120} className={reverse ? "lg:order-1" : "lg:order-2"}>
        <div ref={frameRef} style={{ transform: `translateY(${offset}px)` }}>
          <LazyMount fallback={<ShowcaseSkeleton heightPx={cropHeight} />} minHeightPx={cropHeight + 45}>
            <BrowserFrame address={address} contentWidth={contentWidth} cropHeight={cropHeight}>
              {visual}
            </BrowserFrame>
          </LazyMount>
        </div>
      </ScrollReveal>
    </div>
  );
}
