"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";

const AMPLITUDE_PX = 14;

/**
 * A subtle scroll-linked drift for a showcase frame, transform only
 * (translateY), rAF-throttled, never touching layout. Takes the caller's
 * own `useRef` result rather than creating and returning one itself, so
 * the ref the caller passes to `ref={...}` always comes straight from a
 * local `useRef` call, the one pattern react-hooks' ref-safety analysis
 * can verify as safe. Returns just the offset in px; skips its scroll
 * listener entirely (offset stays 0) when the visitor prefers reduced
 * motion, checked once inside the effect rather than at initial render so
 * server and client markup never disagree before hydration.
 */
export function useParallax<T extends HTMLElement>(elementRef: RefObject<T | null>): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const node = elementRef.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;

    function update() {
      const node = elementRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const viewportMid = window.innerHeight / 2;
      const elementMid = rect.top + rect.height / 2;
      const distance = (viewportMid - elementMid) / viewportMid;
      const clamped = Math.max(-1, Math.min(1, distance));
      setOffset(clamped * AMPLITUDE_PX);
    }

    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [elementRef]);

  return offset;
}
