"use client";

import * as React from "react";

import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";

const STORAGE_KEY = "openpath:sidebar-width";
const MIN = 208;
const MAX = 400;
const DEFAULT = 256;
/** Dragging narrower than this means the user wants it closed. */
const COLLAPSE_AT = MIN - 40;

const clamp = (n: number) => Math.min(MAX, Math.max(MIN, n));

type ShellContext = {
  setWidth: (px: number, persist?: boolean) => void;
  getWidth: () => number;
};

const ShellContext = React.createContext<ShellContext | null>(null);

function useShell() {
  const ctx = React.useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside AppShell");
  return ctx;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  // Source of truth for width; reading computed style lags a frame on key repeat.
  const widthRef = React.useRef(DEFAULT);

  const setWidth = React.useCallback((px: number, persist = false) => {
    const w = clamp(px);
    widthRef.current = w;
    ref.current?.style.setProperty("--sidebar-width", `${w}px`);
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, String(w));
      } catch {
        // Private mode blocks localStorage — fall back to the default width.
      }
    }
  }, []);

  const getWidth = React.useCallback(() => widthRef.current, []);

  // Restore the saved width by touching the DOM directly — no setState in an effect.
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const w = clamp(Number(saved));
        widthRef.current = w;
        ref.current?.style.setProperty("--sidebar-width", `${w}px`);
      }
    } catch {
      // ignore
    }
  }, []);

  const value = React.useMemo(() => ({ setWidth, getWidth }), [setWidth, getWidth]);

  return (
    <ShellContext.Provider value={value}>
      <SidebarProvider
        ref={ref}
        style={{ "--sidebar-width": `${DEFAULT}px` } as React.CSSProperties}
      >
        {children}
        <SidebarEdge />
      </SidebarProvider>
    </ShellContext.Provider>
  );
}

/**
 * The sidebar's right edge, present only while the rail is open: drag to
 * resize, drag past the threshold or double-click to close. Reopening is via
 * the header button or ⌘B — nothing appears on hover.
 */
function SidebarEdge() {
  const { setWidth, getWidth } = useShell();
  const { state, toggleSidebar, isMobile } = useSidebar();
  const [dragging, setDragging] = React.useState(false);
  // Only updates when the gesture ends — no re-render per dragged pixel.
  const [committed, setCommitted] = React.useState(getWidth);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    setDragging(true);

    const startX = e.clientX;
    const startW = getWidth();
    let closed = false;

    const onMove = (ev: PointerEvent) => {
      const next = startW + (ev.clientX - startX);
      if (next < COLLAPSE_AT) {
        // Dragged past the threshold: close and end the gesture.
        closed = true;
        toggleSidebar();
        cleanup();
        return;
      }
      setWidth(next);
    };

    const cleanup = () => {
      setDragging(false);
      if (!closed) setWidth(getWidth(), true);
      setCommitted(getWidth());
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // pointer already gone
      }
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", cleanup);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", cleanup);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 32 : 8;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setWidth(getWidth() - step, true);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setWidth(getWidth() + step, true);
    } else if (e.key === "Home") {
      e.preventDefault();
      setWidth(DEFAULT, true);
    } else {
      return;
    }
    setCommitted(getWidth());
  }

  // Once collapsed the edge is removed entirely — no invisible hit target left.
  if (isMobile || state === "collapsed") return null;

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Kéo để đổi rộng thanh bên, nhấn đúp để đóng"
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      aria-valuenow={committed}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={toggleSidebar}
      data-dragging={dragging || undefined}
      style={{ left: "var(--sidebar-width)" }}
      className="group/edge fixed inset-y-0 z-50 hidden w-2 -translate-x-1/2 cursor-col-resize touch-none outline-none sm:block"
    >
      {/* The hairline shows only on hover, focus or drag — always operable, never noisy. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-foreground/40 opacity-0 transition-opacity duration-150 group-hover/edge:opacity-100 group-focus-visible/edge:opacity-100 group-data-dragging/edge:opacity-100 motion-reduce:transition-none"
      />
    </div>
  );
}
