import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

export const RAIL_WIDTH_MIN = 192;
export const RAIL_WIDTH_MAX = 320;
export const RAIL_WIDTH_DEFAULT = 256;
const STORAGE_KEY = "openpath.rail-width";

function clampWidth(n: number) {
  return Math.min(RAIL_WIDTH_MAX, Math.max(RAIL_WIDTH_MIN, Math.round(n)));
}

function readStoredWidth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return RAIL_WIDTH_DEFAULT;
    const n = Number(raw);
    return Number.isFinite(n) ? clampWidth(n) : RAIL_WIDTH_DEFAULT;
  } catch {
    return RAIL_WIDTH_DEFAULT;
  }
}

export function useRailWidth() {
  const [width, setWidth] = useState(RAIL_WIDTH_DEFAULT);

  useEffect(() => {
    setWidth(readStoredWidth());
  }, []);

  const commit = useCallback((next: number) => {
    const w = clampWidth(next);
    setWidth(w);
    try {
      localStorage.setItem(STORAGE_KEY, String(w));
    } catch {
      /* private mode */
    }
  }, []);

  return { width, setWidth: (n: number) => setWidth(clampWidth(n)), commit };
}

export function RailResize({
  width,
  onLive,
  onCommit,
}: {
  width: number;
  onLive: (n: number) => void;
  onCommit: (n: number) => void;
}) {
  const drag = useRef<{ startX: number; startW: number } | null>(null);
  const live = useRef(width);
  live.current = width;
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    const prevSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    return () => {
      document.body.style.userSelect = prevSelect;
      document.body.style.cursor = prevCursor;
    };
  }, [dragging]);

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startW: live.current };
    setDragging(true);
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    onLive(drag.current.startW + e.clientX - drag.current.startX);
  }

  function endDrag() {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    onCommit(live.current);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const step = e.shiftKey ? 32 : 8;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onCommit(width + step);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onCommit(width - step);
    } else if (e.key === "Home") {
      e.preventDefault();
      onCommit(RAIL_WIDTH_MIN);
    } else if (e.key === "End") {
      e.preventDefault();
      onCommit(RAIL_WIDTH_MAX);
    }
  }

  return (
    <button
      type="button"
      data-rail-resize
      data-dragging={dragging || undefined}
      aria-label="Resize navigation"
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={RAIL_WIDTH_MIN}
      aria-valuemax={RAIL_WIDTH_MAX}
      aria-valuenow={width}
      className="group absolute inset-y-0 right-0 z-[var(--z-sticky)] hidden w-2 translate-x-1/2 cursor-col-resize touch-none md:block"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => onCommit(RAIL_WIDTH_DEFAULT)}
      onKeyDown={onKeyDown}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent group-hover:bg-hairline",
          dragging && "bg-accent",
        )}
      />
    </button>
  );
}
