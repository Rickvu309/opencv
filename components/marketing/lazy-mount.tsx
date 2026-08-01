"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface LazyMountProps {
  /** Only rendered once the placeholder scrolls near the viewport; keeps every showcase's chunk and real product data out of the initial bundle. */
  children: ReactNode;
  fallback: ReactNode;
  /** Reserved height for the fallback, so mounting the real content never shifts layout. */
  minHeightPx: number;
}

export function LazyMount({ children, fallback, minHeightPx }: LazyMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldMount(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "300px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={shouldMount ? undefined : { minHeight: minHeightPx }}>
      {shouldMount ? children : fallback}
    </div>
  );
}
