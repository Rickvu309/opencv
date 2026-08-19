import { useEffect, useState } from "react";
import { useCoachSession } from "@/features/coach/components/session";

const MIN_CHARS = 3;

type Clip = { text: string; label?: string; x: number; y: number };

function selectionFromField(): { text: string; label?: string; rect: DOMRect } | null {
  const el = document.activeElement;
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement
  ) {
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (end - start < MIN_CHARS) return null;
    const text = el.value.slice(start, end).trim();
    if (text.length < MIN_CHARS) return null;
    return {
      text,
      label: el.getAttribute("aria-label") ?? undefined,
      rect: el.getBoundingClientRect(),
    };
  }
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const text = sel.toString().trim();
  if (text.length < MIN_CHARS) return null;
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  return { text, rect };
}

export function SelectionMenu() {
  const { addExcerpt } = useCoachSession();
  const [clip, setClip] = useState<Clip | null>(null);

  useEffect(() => {
    function onSelect() {
      const found = selectionFromField();
      if (!found) {
        setClip(null);
        return;
      }
      setClip({
        text: found.text,
        label: found.label,
        x: found.rect.left,
        y: found.rect.bottom + 8,
      });
    }
    document.addEventListener("mouseup", onSelect);
    document.addEventListener("keyup", onSelect);
    return () => {
      document.removeEventListener("mouseup", onSelect);
      document.removeEventListener("keyup", onSelect);
    };
  }, []);

  if (!clip) return null;

  return (
    <div
      data-print-hide
      role="toolbar"
      aria-label="Selection"
      className="fixed z-[var(--z-overlay)] flex gap-1 rounded-[var(--radius-control)] border border-hairline bg-surface-1 p-1 shadow-[var(--shadow-overlay)] print:hidden"
      style={{ left: clip.x, top: clip.y }}
    >
      <button
        type="button"
        className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-[13px] text-ink hover:bg-surface-2"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          void navigator.clipboard.writeText(clip.text);
          setClip(null);
        }}
      >
        Copy
      </button>
      <button
        type="button"
        className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-[13px] text-ink hover:bg-surface-2"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          addExcerpt({ text: clip.text, label: clip.label });
          setClip(null);
        }}
      >
        Add to Coach
      </button>
    </div>
  );
}
