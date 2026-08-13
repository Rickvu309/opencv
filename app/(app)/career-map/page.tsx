"use client";

import * as React from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  originNode,
  pathEdges,
  pathNodes,
  youNode,
  type StageId,
} from "@/lib/career-graph";
import {
  corridor,
  layout,
  NODE_H,
  NODE_W,
  PathCanvas,
  useCanvasView,
  type Positions,
} from "@/components/career/path-canvas";
import { AddPathPopover } from "@/components/career/add-path-popover";
import { NodeInspector } from "@/components/career/node-inspector";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppState, useDispatch } from "@/lib/actions/store";
import { useT } from "@/lib/i18n/use-t";

export default function CareerMapPage() {
  // The map's content, the goal and any roles added to it, is the user's, so
  // it lives in the store where the Coach can reach it. Node positions stay
  // local: they are canvas layout, and the agent has no business rearranging
  // a diagram it cannot see.
  const { paths, profile } = useAppState();
  const dispatch = useDispatch();
  const { t, m, locale } = useT();
  const { targetId, customNodes: extraNodes, customEdges: extraEdges } = paths;

  const [moved, setMoved] = React.useState<Positions>({});
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const { view, setView } = useCanvasView();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [animate, setAnimate] = React.useState(false);
  const animTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Enable glide for one programmatic view change, then turn it back off. */
  const glide = React.useCallback(() => {
    setAnimate(true);
    if (animTimer.current) clearTimeout(animTimer.current);
    animTimer.current = setTimeout(() => setAnimate(false), 320);
  }, []);

  React.useEffect(
    () => () => {
      if (animTimer.current) clearTimeout(animTimer.current);
    },
    [],
  );

  // The origin is the only node that is about the user rather than about the
  // job market, so it is the only one built from state. Everything downstream
  // (layout, corridor, the inspector) treats it like any other node.
  const nodes = React.useMemo(
    () => [
      youNode(profile, locale),
      ...pathNodes.filter((n) => n.id !== originNode.id),
      ...extraNodes,
    ],
    [profile, extraNodes, locale],
  );
  const edges = React.useMemo(
    () => [...pathEdges, ...extraEdges],
    [extraEdges],
  );
  const positions = React.useMemo(
    () => ({ ...layout(nodes), ...moved }),
    [nodes, moved],
  );

  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  const route = React.useMemo(
    () => (targetId ? corridor(edges, "you", targetId) : null),
    [edges, targetId],
  );

  /** Fit the whole diagram into the viewport. */
  const fit = React.useCallback((target?: HTMLDivElement) => {
    const el = target ?? containerRef.current;
    if (!el || !el.clientWidth || !el.clientHeight) return;
    const pts = Object.values(positions);
    if (!pts.length) return;
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x)) + NODE_W;
    const minY = Math.min(...pts.map((p) => p.y)) - 60;
    const maxY = Math.max(...pts.map((p) => p.y)) + NODE_H;
    const pad = 48;
    const w = el.clientWidth - pad * 2;
    const h = el.clientHeight - pad * 2;

    // A phone cannot fit this diagram at any readable size: five columns span
    // ~1360px against under 300 of frame. Fitting anyway pins k to the 0.55
    // floor, which renders 14px node titles at 7.7px, and even then only 4 of
    // 13 nodes land fully on screen. So below sm, don't fit. Start at full size
    // with "you" at the leading edge and let the user drag. A few legible nodes
    // beat all of them illegible.
    if (el.clientWidth < 640) {
      const you = positions.you;
      setView({
        k: 1,
        x: pad - (you?.x ?? minX),
        y: el.clientHeight / 2 - (you?.y ?? 0) - NODE_H / 2,
      });
      return;
    }

    const k = Math.max(0.55, Math.min(w / (maxX - minX), h / (maxY - minY), 1));
    const contentW = (maxX - minX) * k;
    const contentH = (maxY - minY) * k;
    setView({
      k,
      x: pad + (contentW <= w ? (w - contentW) / 2 : 0) - minX * k,
      y: pad + (contentH <= h ? (h - contentH) / 2 : 0) - minY * k,
    });
  }, [positions, setView]);

  // Fit exactly once, as soon as the canvas has real dimensions. Hooked to DOM
  // attach rather than first render, and retries until it can measure.
  const didFit = React.useRef(false);
  const fitRef = React.useRef(fit);
  React.useEffect(() => {
    fitRef.current = fit;
  }, [fit]);

  // Selecting a node opens the inspector, which can cover that very node. Pan
  // the minimum needed to keep the selection visible.
  const posRef = React.useRef(positions);
  const viewRef = React.useRef(view);
  React.useEffect(() => {
    posRef.current = positions;
    viewRef.current = view;
  }, [positions, view]);

  React.useEffect(() => {
    if (!selectedId) return;
    const raf = requestAnimationFrame(() => {
      const el = containerRef.current;
      const p = posRef.current[selectedId];
      if (!el || !p) return;
      const v = viewRef.current;
      const pad = 24;
      // On narrow screens the inspector is a bottom sheet covering 60%, so the
      // visible region is only the top part, measure against that, not the frame.
      const wide = window.matchMedia("(min-width: 640px)").matches;
      const visibleH = wide ? el.clientHeight : el.clientHeight * 0.4;
      const left = p.x * v.k + v.x;
      const top = p.y * v.k + v.y;
      const right = left + NODE_W * v.k;
      const bottom = top + NODE_H * v.k;
      let dx = 0;
      let dy = 0;
      if (right > el.clientWidth - pad) dx = el.clientWidth - pad - right;
      if (left + dx < pad) dx = pad - left;
      if (bottom > visibleH - pad) dy = visibleH - pad - bottom;
      if (top + dy < pad) dy = pad - top;
      if (dx || dy) {
        glide();
        setView((s) => ({ ...s, x: s.x + dx, y: s.y + dy }));
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedId, glide, setView]);

  const handleReady = React.useCallback((el: HTMLDivElement) => {
    if (didFit.current) return;
    // Wait for the first frame that can measure real dimensions before fitting.
    let tries = 0;
    const attempt = () => {
      if (didFit.current) return;
      if (el.isConnected && el.clientWidth && el.clientHeight) {
        didFit.current = true;
        fitRef.current(el);
        return;
      }
      if (tries++ < 30) requestAnimationFrame(attempt);
    };
    requestAnimationFrame(attempt);
  }, []);

  function zoom(factor: number) {
    const el = containerRef.current;
    if (!el) return;
    glide();
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    setView((v) => {
      const k = Math.min(1.6, Math.max(0.4, v.k * factor));
      return {
        k,
        x: cx - ((cx - v.x) / v.k) * k,
        y: cy - ((cy - v.y) / v.k) * k,
      };
    });
  }

  function setTarget(id: string) {
    const n = nodes.find((x) => x.id === id);
    dispatch("path.setTarget", { id }, { silent: true });
    toast.success(t(m.map.goalSet(n?.title ?? "")), {
      description: t(m.map.goalSetBody),
    });
  }

  // Same as Todo: the reducer mints the id, so the new node is found by
  // watching the list rather than by re-deriving the id here.
  const selectNewest = React.useRef(false);
  React.useEffect(() => {
    const newest = extraNodes.at(-1);
    if (selectNewest.current && newest) {
      setSelectedId(newest.id);
      selectNewest.current = false;
    }
  }, [extraNodes]);

  function addNode(title: string, stage: StageId, fromId: string) {
    selectNewest.current = true;
    dispatch("path.addNode", { title, stage, fromId }, { silent: true });
    toast.success(t(m.map.added(title)), {
      description: t(m.map.addedBody),
    });
  }

  function removeNode(id: string) {
    dispatch("path.removeNode", { id }, { silent: true });
    setSelectedId(null);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar: say what the diagram is, then the controls. */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <p className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground sm:block">
          {t(m.map.intro)}
        </p>
        <span className="flex-1 sm:hidden" />

        <AddPathPopover
          fromId={selectedId ?? "you"}
          fromTitle={selected?.title ?? t(m.map.youToday)}
          onAdd={addNode}
        />

        <div className="flex items-center gap-0.5 rounded-lg border bg-card p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => zoom(1 / 1.2)}
                aria-label={t(m.map.zoomOut)}
                className="text-muted-foreground"
              >
                <Minus />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t(m.map.zoomOut)}</TooltipContent>
          </Tooltip>
          <span className="w-10 text-center text-xs text-muted-foreground tabular-nums">
            {Math.round(view.k * 100)}%
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => zoom(1.2)}
                aria-label={t(m.map.zoomIn)}
                className="text-muted-foreground"
              >
                <Plus />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t(m.map.zoomIn)}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => { glide(); fit(); }}
                aria-label={t(m.map.fit)}
                className="text-muted-foreground"
              >
                <Maximize2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t(m.map.fit)}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
        <PathCanvas
          nodes={nodes}
          edges={edges}
          positions={positions}
          onMoveNode={(id, x, y) =>
            setMoved((prev) => ({ ...prev, [id]: { x, y } }))
          }
          selectedId={selectedId}
          targetId={targetId}
          onSelect={setSelectedId}
          view={view}
          setView={setView}
          containerRef={containerRef}
          onReady={handleReady}
          animate={animate}
        />

        {/* Small legend, enough to know what a bold edge means. */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 rounded-lg border bg-card/90 px-2.5 py-1.5 text-[11px] text-muted-foreground backdrop-blur-sm">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-foreground" aria-hidden />
            {t(m.map.legendRoute)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-4 rounded-full bg-muted" aria-hidden />
            {t(m.map.legendFit)}
          </span>
        </div>
        </div>

        {selected && (
          <NodeInspector
            node={selected}
            edges={edges}
            nodes={nodes}
            isTarget={selected.id === targetId}
            onRoute={!!route?.nodes.has(selected.id)}
            onClose={() => setSelectedId(null)}
            onSetTarget={() => setTarget(selected.id)}
            onRemove={() => removeNode(selected.id)}
          />
        )}
      </div>
    </div>
  );
}
