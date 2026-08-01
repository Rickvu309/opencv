"use client";

import { useEffect, useState } from "react";

import { OpenOpenPathButton } from "@/components/marketing/open-openpath-button";
import { cn } from "@/lib/utils";

/**
 * Hick's Law (brief section 6): one primary CTA throughout the whole
 * scroll, not a second competing action, just the same "Open OpenPath"
 * reachable without scrolling back to the hero. Quiet until the visitor
 * has actually scrolled past the hero's own copy of this button.
 */
export function StickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 560);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      inert={!visible}
      aria-hidden={!visible}
      className={cn(
        "fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-border bg-background/85 px-6 py-2.5 backdrop-blur motion-safe:transition-[opacity,transform] motion-safe:duration-300",
        visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      )}
    >
      <span className="text-sm font-semibold text-foreground">OpenPath</span>
      <OpenOpenPathButton size="sm" />
    </div>
  );
}
