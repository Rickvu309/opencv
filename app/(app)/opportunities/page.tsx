"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Crosshair,
  Maximize2,
  Megaphone,
  Minus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  defaultTargetId,
  pathEdges,
  pathNodes,
  stages,
  type PathEdge,
  type PathNode,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export default function OpportunitiesPage() {
  const [extraNodes, setExtraNodes] = React.useState<PathNode[]>([]);
  const [extraEdges, setExtraEdges] = React.useState<PathEdge[]>([]);
  const [moved, setMoved] = React.useState<Positions>({});
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [targetId, setTargetId] = React.useState<string | null>(defaultTargetId);
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

  const nodes = React.useMemo(
    () => [...pathNodes, ...extraNodes],
    [extraNodes],
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
    // Never shrink below readable: on narrow screens anchor left and invite a
    // sideways drag rather than fitting everything at illegible size.
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
      // visible region is only the top part — measure against that, not the frame.
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
    setTargetId(id);
    const n = nodes.find((x) => x.id === id);
    toast.success(`Đã đặt ${n?.title} làm mục tiêu`, {
      description: "Mọi đường tới đích đang sáng trên sơ đồ.",
    });
  }

  function addNode(title: string, stage: StageId, fromId: string) {
    const id = `custom-${Date.now()}`;
    setExtraNodes((prev) => [
      ...prev,
      {
        id,
        title,
        stage,
        summary: "Hướng đi bạn tự thêm vào bản đồ.",
        custom: true,
      },
    ]);
    setExtraEdges((prev) => [...prev, { from: fromId, to: id }]);
    setSelectedId(id);
    toast.success(`Đã thêm ${title}`, {
      description: "Kéo để đặt lại vị trí, hoặc nhờ coach đánh giá hướng này.",
    });
  }

  function removeNode(id: string) {
    setExtraNodes((prev) => prev.filter((n) => n.id !== id));
    setExtraEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
    if (targetId === id) setTargetId(null);
    setSelectedId(null);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar: say what the diagram is, then the controls. */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <p className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground sm:block">
          Từ hồ sơ hôm nay tới các vai trò bạn có thể tới — kéo để xem, bấm một
          nút để mở chi tiết.
        </p>
        <span className="flex-1 sm:hidden" />

        <AddPathPopover
          fromId={selectedId ?? "you"}
          fromTitle={selected?.title ?? "Bạn hôm nay"}
          onAdd={addNode}
        />

        <div className="flex items-center gap-0.5 rounded-lg border bg-card p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => zoom(1 / 1.2)}
                aria-label="Thu nhỏ"
                className="text-muted-foreground"
              >
                <Minus />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Thu nhỏ</TooltipContent>
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
                aria-label="Phóng to"
                className="text-muted-foreground"
              >
                <Plus />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Phóng to</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => { glide(); fit(); }}
                aria-label="Vừa khung"
                className="text-muted-foreground"
              >
                <Maximize2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Vừa khung</TooltipContent>
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

        {/* Small legend — enough to know what a bold edge means. */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 rounded-lg border bg-card/90 px-2.5 py-1.5 text-[11px] text-muted-foreground backdrop-blur-sm">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-foreground" aria-hidden />
            Đường tới mục tiêu
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-4 rounded-full bg-muted" aria-hidden />
            Độ phù hợp
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

/** Add your own path, wired from the selected node. */
function AddPathPopover({
  fromId,
  fromTitle,
  onAdd,
}: {
  fromId: string;
  fromTitle: string;
  onAdd: (title: string, stage: StageId, fromId: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [stage, setStage] = React.useState<StageId>("core");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd(t, stage, fromId);
    setTitle("");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          <Plus className="size-3.5" />
          Thêm hướng đi
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <form onSubmit={submit}>
          <div className="grid gap-3 p-3">
            <div className="grid gap-1.5">
              <Label htmlFor="np-title">Tên vai trò</Label>
              <Input
                id="np-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Data Scientist"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Nằm ở cột</Label>
              <div className="flex flex-wrap gap-1">
                {stages
                  .filter((s) => s.id !== "now")
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStage(s.id)}
                      aria-pressed={stage === s.id}
                      className={cn(
                        "h-7 rounded-md border px-2 text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                        stage === s.id
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "bg-card text-muted-foreground hover:bg-muted/60",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Sẽ nối từ <span className="font-medium text-foreground">{fromTitle}</span>.
              Chọn một nút khác trước khi thêm để đổi điểm nối.
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t bg-muted/40 px-3 py-2.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Huỷ
            </Button>
            <Button type="submit" size="sm" disabled={!title.trim()}>
              Thêm vào sơ đồ
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Inspector: lives inside the page frame, not a modal covering the diagram. */
function NodeInspector({
  node,
  nodes,
  edges,
  isTarget,
  onRoute,
  onClose,
  onSetTarget,
  onRemove,
}: {
  node: PathNode;
  nodes: PathNode[];
  edges: PathEdge[];
  isTarget: boolean;
  onRoute: boolean;
  onClose: () => void;
  onSetTarget: () => void;
  onRemove: () => void;
}) {
  const incoming = edges.filter((e) => e.to === node.id);
  const outgoing = edges.filter((e) => e.from === node.id);
  const title = (id: string) => nodes.find((n) => n.id === id)?.title ?? id;
  const stage = stages.find((s) => s.id === node.stage);

  return (
    <aside
      aria-label={`Chi tiết ${node.title}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className={cn(
        // Mobile: bottom sheet. From sm: a real right column that never covers the diagram.
        "absolute inset-x-0 bottom-0 z-10 flex max-h-[60%] flex-col border-t bg-card",
        "sm:static sm:z-auto sm:max-h-none sm:w-80 sm:shrink-0 sm:border-t-0 sm:border-l",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-200 sm:motion-safe:slide-in-from-bottom-0 sm:motion-safe:slide-in-from-right-4",
      )}
    >
      <div className="flex shrink-0 items-start gap-2 border-b py-3 pr-2 pl-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            {stage?.label} · {stage?.horizon}
          </p>
          <h2 className="mt-0.5 text-base font-semibold tracking-tight">
            {node.title}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Đóng chi tiết"
          className="text-muted-foreground"
        >
          <X />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <p className="text-sm leading-relaxed">{node.summary}</p>
          {(node.fit !== undefined || node.salary) && (
            <dl className="mt-3 grid grid-cols-2 gap-3">
              {node.fit !== undefined && (
                <div>
                  <dt className="text-xs text-muted-foreground">Độ phù hợp</dt>
                  <dd className="mt-0.5 text-lg font-semibold tracking-tight tabular-nums">
                    {node.fit}%
                  </dd>
                </div>
              )}
              {node.salary && (
                <div>
                  <dt className="text-xs text-muted-foreground">Lương tham khảo</dt>
                  <dd className="mt-0.5 text-sm font-medium tabular-nums">
                    {node.salary}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {node.does && node.does.length > 0 && (
          <div className="border-t px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              {node.id === "you" ? "Bạn đang có" : "Ở vai trò này bạn làm gì"}
            </p>
            <ul className="mt-2 space-y-2">
              {node.does.map((d) => (
                <li key={d} className="flex gap-2.5 text-sm">
                  <span
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                    aria-hidden
                  />
                  <span className="min-w-0 leading-relaxed">{d}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {node.requires && node.requires.length > 0 && (
          <div className="border-t px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              Cần có để bước vào
            </p>
            <ul className="mt-2 space-y-2">
              {node.requires.map((r) => (
                <li key={r} className="flex gap-2.5 text-sm">
                  <Check
                    className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="min-w-0 leading-relaxed">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {incoming.length > 0 && (
          <div className="border-t px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Đến từ</p>
            <ul className="mt-2 space-y-2">
              {incoming.map((e) => (
                <li key={`${e.from}-${e.to}`} className="text-sm">
                  <p className="font-medium">{title(e.from)}</p>
                  {e.via && (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {e.via}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {outgoing.length > 0 && (
          <div className="border-t px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              Từ đây đi tiếp
            </p>
            <ul className="mt-2 space-y-2">
              {outgoing.map((e) => (
                <li key={`${e.from}-${e.to}`} className="text-sm">
                  <p className="font-medium">{title(e.to)}</p>
                  {e.via && (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {e.via}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Leave room on mobile for the floating coach strip at the bottom. */}
      <div className="shrink-0 space-y-1 border-t p-2 pb-11 sm:pb-2">
        {node.id !== "you" && (
          <Button
            variant={isTarget ? "outline" : "default"}
            size="sm"
            className="w-full justify-start"
            onClick={onSetTarget}
            disabled={isTarget}
          >
            <Crosshair className="size-3.5" />
            {isTarget ? "Đang là mục tiêu của bạn" : "Đặt làm mục tiêu"}
          </Button>
        )}
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="w-full justify-between"
        >
          <Link
            href={`/coach?q=${encodeURIComponent(
              node.id === "you"
                ? "Nhìn hồ sơ hiện tại, mình hợp với hướng đi nào nhất?"
                : `Mình cần gì để đi tới vai trò ${node.title}?`,
            )}`}
          >
            <span className="flex items-center gap-1.5">
              <Megaphone className="size-3.5" />
              Hỏi coach về hướng này
            </span>
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        {onRoute && !isTarget && node.id !== "you" && (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            Vai trò này nằm trên đường tới mục tiêu hiện tại của bạn.
          </p>
        )}
        {node.custom && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
            Xoá khỏi sơ đồ
          </Button>
        )}
      </div>
    </aside>
  );
}
