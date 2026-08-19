import { useLayoutEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { emptyCv, type PaperContent } from "@/features/paper/model";
import { PaperPage } from "@/features/paper/components/page";
import { Hoverable } from "@/ui/hoverable";
import { cn } from "@/lib/utils";

const A4_WIDTH_PX = (210 / 25.4) * 96;
const A4_RATIO = "1 / 1.41421356237";

export function PaperThumb({
  kind,
  content,
  dashed = false,
}: {
  kind: string;
  content: PaperContent;
  dashed?: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => {
      setScale(el.clientWidth / A4_WIDTH_PX);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      className={cn(
        "relative overflow-hidden bg-surface-2",
        dashed ? "border border-dashed border-hairline" : "border border-hairline",
      )}
      style={{
        aspectRatio: A4_RATIO,
        borderRadius: "var(--radius-container)",
      }}
    >
      <div
        className="pointer-events-none origin-top-left bg-white"
        style={{
          width: A4_WIDTH_PX,
          transform: `scale(${scale})`,
          visibility: scale === 0 ? "hidden" : "visible",
        }}
      >
        <PaperPage kind={kind} content={content} preview />
      </div>
    </div>
  );
}

export function NewCvCard({ onSelect }: { onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full origin-center text-left transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.97]"
    >
      <PaperThumb kind="cv" content={emptyCv()} dashed />
      <p className="mt-3 text-[12px] leading-[1.5] text-ink">New CV</p>
    </button>
  );
}

export function PaperDriveCard({
  kind,
  content,
  title,
  updated,
  menu,
  onSelect,
}: {
  kind: string;
  content: PaperContent;
  title: string;
  updated: string;
  menu?: ReactNode;
  onSelect: () => void;
}) {
  return (
    <div
      data-hover-group="row"
      className="relative origin-center transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.97]"
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <PaperThumb kind={kind} content={content} />
        <p className="mt-3 min-w-0 overflow-visible text-[12px] leading-[1.5] text-ink">{title}</p>
        <p className="text-[12px] leading-[1.5] text-ink-muted tabular-nums">{updated}</p>
      </button>
      {menu ? (
        <Hoverable.Item className="absolute right-0 bottom-0">{menu}</Hoverable.Item>
      ) : null}
    </div>
  );
}

export function PaperDriveGrid({
  children,
  dropOver = false,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  children: ReactNode;
  dropOver?: boolean;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "grid grid-cols-1 gap-6 md:grid-cols-2",
        dropOver && "rounded-[var(--radius-container)] outline outline-dashed outline-hairline",
      )}
    >
      {children}
    </div>
  );
}
