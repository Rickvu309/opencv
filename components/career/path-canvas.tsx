"use client";

import * as React from "react";

import {
  stages,
  type PathEdge,
  type PathNode,
  type StageId,
} from "@/lib/career-graph";
import { cn } from "@/lib/utils";

export const NODE_W = 208;
export const NODE_H = 76;
const COL_GAP = 288;
const ROW_GAP = 104;

export type Positions = Record<string, { x: number; y: number }>;

/** Lay out by time column, each column vertically centred. */
export function layout(nodes: PathNode[]): Positions {
  const pos: Positions = {};
  for (const [col, stage] of stages.entries()) {
    const inStage = nodes.filter((n) => n.stage === stage.id);
    inStage.forEach((n, i) => {
      pos[n.id] = {
        x: col * COL_GAP,
        y: (i - (inStage.length - 1) / 2) * ROW_GAP,
      };
    });
  }
  return pos;
}

/** Curve between two nodes — horizontal bezier, never a hard corner. */
function edgePath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const x1 = a.x + NODE_W;
  const y1 = a.y + NODE_H / 2;
  const x2 = b.x;
  const y2 = b.y + NODE_H / 2;
  const dx = Math.max(40, (x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/** Walk edges to collect everything up- or downstream of a node. */
function walk(edges: PathEdge[], start: string, dir: "fwd" | "back") {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const id = queue.shift()!;
    for (const e of edges) {
      const [from, to] = dir === "fwd" ? [e.from, e.to] : [e.to, e.from];
      if (from === id && !seen.has(to)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  return seen;
}

/**
 * Corridor to the target: every edge on a valid path from `origin` to
 * `target`. Not one route — all the ways to get there.
 */
export function corridor(edges: PathEdge[], origin: string, target: string) {
  const fwd = walk(edges, origin, "fwd");
  const back = walk(edges, target, "back");
  const nodes = new Set([...fwd].filter((id) => back.has(id)));
  const edgeKeys = new Set(
    edges
      .filter((e) => fwd.has(e.from) && back.has(e.to) && nodes.has(e.from) && nodes.has(e.to))
      .map((e) => `${e.from}->${e.to}`),
  );
  return { nodes, edges: edgeKeys };
}

/** Both branches around a node — used on hover. */
export function lineage(edges: PathEdge[], id: string) {
  const fwd = walk(edges, id, "fwd");
  const back = walk(edges, id, "back");
  const nodes = new Set([...fwd, ...back]);
  const edgeKeys = new Set(
    edges
      .filter(
        (e) =>
          (fwd.has(e.from) && fwd.has(e.to)) ||
          (back.has(e.from) && back.has(e.to)),
      )
      .map((e) => `${e.from}->${e.to}`),
  );
  return { nodes, edges: edgeKeys };
}

type View = { x: number; y: number; k: number };

/** The pointer may already be gone; never let that break the gesture. */
function release(el: HTMLElement, pointerId: number) {
  try {
    el.releasePointerCapture(pointerId);
  } catch {
    // pointer already released
  }
}

const MIN_K = 0.4;
const MAX_K = 1.6;

export function useCanvasView() {
  const [view, setView] = React.useState<View>({ x: 0, y: 0, k: 1 });
  return { view, setView };
}

export function PathCanvas({
  nodes,
  edges,
  positions,
  onMoveNode,
  selectedId,
  targetId,
  onSelect,
  view,
  setView,
  containerRef,
  onReady,
  animate,
}: {
  nodes: PathNode[];
  edges: PathEdge[];
  positions: Positions;
  onMoveNode: (id: string, x: number, y: number) => void;
  selectedId: string | null;
  targetId: string | null;
  onSelect: (id: string) => void;
  view: View;
  setView: React.Dispatch<React.SetStateAction<View>>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Fired once the canvas is in the DOM — the reliable point to fit the view. */
  onReady?: (el: HTMLDivElement) => void;
  /** Only for programmatic view changes (zoom buttons, fit, reveal). Hand
   *  panning must track 1:1, so it never animates. */
  animate?: boolean;
}) {
  const [hoverId, setHoverId] = React.useState<string | null>(null);
  const [panning, setPanning] = React.useState(false);

  const focus = React.useMemo(() => {
    if (hoverId) return lineage(edges, hoverId);
    return null;
  }, [edges, hoverId]);

  const route = React.useMemo(
    () => (targetId ? corridor(edges, "you", targetId) : null),
    [edges, targetId],
  );

  // Drag the background to pan the view.
  function onBackgroundPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    setPanning(true);
    const start = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };

    const move = (ev: PointerEvent) => {
      setView((v) => ({
        ...v,
        x: start.vx + (ev.clientX - start.x),
        y: start.vy + (ev.clientY - start.y),
      }));
    };
    const up = () => {
      setPanning(false);
      release(el, e.pointerId);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  }

  /**
   * Dragging a node: capture the pointer on the node and stop propagation so
   * the canvas does not pan underneath. The grab point is converted to diagram
   * coordinates so the node does not jump on grab.
   */
  function onNodePointerDown(e: React.PointerEvent, id: string) {
    if (e.button !== 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    const p = positions[id];
    if (!rect || !p) return;
    e.stopPropagation();

    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const grabX = (e.clientX - rect.left - view.x) / view.k - p.x;
    const grabY = (e.clientY - rect.top - view.y) / view.k - p.y;

    const move = (ev: PointerEvent) => {
      onMoveNode(
        id,
        (ev.clientX - rect.left - view.x) / view.k - grabX,
        (ev.clientY - rect.top - view.y) / view.k - grabY,
      );
    };
    const up = () => {
      release(el, e.pointerId);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  }

  function onWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      setView((v) => ({ ...v, x: v.x - e.deltaX }));
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setView((v) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * (1 - e.deltaY * 0.0015)));
      return {
        k,
        x: cx - ((cx - v.x) / v.k) * k,
        y: cy - ((cy - v.y) / v.k) * k,
      };
    });
  }

  const stageX: Record<StageId, number> = {} as Record<StageId, number>;
  for (const s of stages) {
    const first = nodes.find((n) => n.stage === s.id);
    stageX[s.id] = first ? positions[first.id].x : 0;
  }

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        if (el) onReady?.(el);
      }}
      onPointerDown={onBackgroundPointerDown}
      onWheel={onWheel}
      className={cn(
        "relative size-full touch-none overflow-hidden select-none",
        panning ? "cursor-grabbing" : "cursor-grab",
      )}
      style={{
        backgroundImage:
          "radial-gradient(circle, var(--color-border) 1px, transparent 1px)",
        backgroundSize: `${24 * view.k}px ${24 * view.k}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
    >
      <div
        className={cn(
          "absolute top-0 left-0 origin-top-left",
          animate &&
            "transition-transform duration-300 ease-out motion-reduce:transition-none",
        )}
        style={{
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.k})`,
        }}
      >
        {/* Column headings: the x-axis is time, so say so. */}
        {stages.map((s) => (
          <div
            key={s.id}
            className="pointer-events-none absolute"
            style={{ left: stageX[s.id], top: -190, width: NODE_W }}
          >
            <p className="text-[13px] font-medium">{s.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.horizon}</p>
          </div>
        ))}

        <svg
          className="pointer-events-none absolute overflow-visible"
          style={{ left: 0, top: 0, width: 1, height: 1 }}
          aria-hidden
        >
          {edges.map((e) => {
            const a = positions[e.from];
            const b = positions[e.to];
            if (!a || !b) return null;
            const key = `${e.from}->${e.to}`;
            const onRoute = route?.edges.has(key);
            const onFocus = focus?.edges.has(key);
            const dimmed = focus ? !onFocus : false;
            return (
              <path
                key={key}
                d={edgePath(a, b)}
                fill="none"
                strokeLinecap="round"
                className={cn(
                  "transition-[stroke,stroke-width,opacity] duration-200 motion-reduce:transition-none",
                  onRoute
                    ? "stroke-foreground"
                    : onFocus
                      ? "stroke-foreground/60"
                      : "stroke-border",
                )}
                strokeWidth={onRoute || onFocus ? 2 : 1.5}
                opacity={dimmed ? 0.35 : 1}
              />
            );
          })}
        </svg>

        {nodes.map((n, i) => {
          const p = positions[n.id];
          if (!p) return null;
          const isYou = n.id === "you";
          const isTarget = n.id === targetId;
          const selected = n.id === selectedId;
          const onRoute = route?.nodes.has(n.id);
          const dimmed = focus ? !focus.nodes.has(n.id) : false;

          return (
            <button
              key={n.id}
              type="button"
              onPointerDown={(e) => onNodePointerDown(e, n.id)}
              onClick={() => onSelect(n.id)}
              onPointerEnter={() => setHoverId(n.id)}
              onPointerLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(n.id)}
              onBlur={() => setHoverId(null)}
              aria-pressed={selected}
              className={cn(
                "absolute flex cursor-grab flex-col justify-center rounded-xl border px-3 text-left transition-[opacity,box-shadow,border-color] duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300 motion-safe:fill-mode-backwards",
                isYou
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card shadow-xs hover:shadow-md",
                selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                onRoute && !isYou && !selected && "border-foreground/40",
                dimmed && "opacity-40",
              )}
              style={{
                left: p.x,
                top: p.y,
                width: NODE_W,
                height: NODE_H,
                animationDelay: `${Math.min(i * 40, 400)}ms`,
              }}
            >
              <span className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {n.title}
                </span>
                {isTarget && (
                  <span className="shrink-0 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">
                    Mục tiêu
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "mt-0.5 truncate text-xs",
                  isYou ? "text-primary-foreground/70" : "text-muted-foreground",
                )}
              >
                {isYou ? n.summary : n.salary}
              </span>
              {n.fit !== undefined && (
                <span className="mt-1.5 flex items-center gap-1.5">
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-foreground"
                      style={{ width: `${n.fit}%` }}
                    />
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {n.fit}%
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
