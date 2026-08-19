import { useEffect, useState } from "react";

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}

/** Elapsed timer in tabular figures: `4.2s` then `1m 8.0s`. */
export function useElapsed(active = true) {
  const [ds, setDs] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setDs((d) => d + 1), 100);
    return () => window.clearInterval(id);
  }, [active]);

  const total = ds / 10;
  if (total < 60) return `${total.toFixed(1)}s`;
  return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;
}
