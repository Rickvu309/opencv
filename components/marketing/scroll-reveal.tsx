"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger delay within a section's own reveal group, in ms. */
  delayMs?: number;
}

/**
 * Scroll-triggered fade-and-small-translate reveal, IntersectionObserver
 * plus CSS only, no animation library (docs/architecture.md's motion
 * judgment call). Transform and opacity only, so it stays 60fps and never
 * causes layout thrash. Reduced motion is handled purely with Tailwind's
 * `motion-safe:` variant on the transition itself (the element still ends
 * up fully visible once observed, just without animating there), not by
 * branching this component's own JS state, so there is no hydration
 * mismatch between server and client from reading matchMedia during render.
 */
export function ScrollReveal({ children, className, delayMs = 0 }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={cn(
        "motion-safe:transition-[opacity,transform] motion-safe:duration-700 motion-safe:ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
}
