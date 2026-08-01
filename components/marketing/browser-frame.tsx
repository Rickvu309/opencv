"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface BrowserFrameProps {
  /** Shown in the chrome bar's address pill, e.g. "openpath.app/opportunities". */
  address: string;
  children: ReactNode;
  /** The natural (desktop) width the real component renders at before scaling down to fit the frame. */
  contentWidth?: number;
  /** The cropped viewport's fixed height in px: a scaled and cropped composition, never a raw full screenshot. */
  cropHeight?: number;
  className?: string;
}

/**
 * The showcase shell every deep-dive composition renders inside (docs
 * brief's "showcase technique"): a browser-chrome frame around a real,
 * live OpenPath component, scaled to fit and cropped to a fixed height. The
 * scale is measured live via ResizeObserver against the frame's own
 * rendered width, so the exact same composition holds at 1440, 1024, 768,
 * and 390 without a separate mobile variant. The inner content is `inert`
 * (no focus, no pointer events, hidden from assistive tech): it is a
 * decorative product visual, not a second, confusing copy of the real app
 * to interact with.
 */
export function BrowserFrame({ address, children, contentWidth = 1040, cropHeight = 360, className }: BrowserFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setScale(width / contentWidth);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [contentWidth]);

  return (
    <div className={cn("overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10", className)}>
      <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-3.5 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-muted-foreground/20" />
          <span className="size-2.5 rounded-full bg-muted-foreground/20" />
          <span className="size-2.5 rounded-full bg-muted-foreground/20" />
        </div>
        <span className="min-w-0 flex-1 truncate rounded-md bg-background px-2.5 py-1 text-center text-[11px] text-muted-foreground ring-1 ring-foreground/8">
          {address}
        </span>
      </div>
      <div ref={containerRef} className="relative overflow-hidden bg-background" style={{ height: cropHeight }}>
        <div
          inert
          aria-hidden="true"
          style={{ width: contentWidth, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          {children}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </div>
    </div>
  );
}
