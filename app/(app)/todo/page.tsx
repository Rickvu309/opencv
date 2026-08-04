"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Clock,
  ListFilter,
  Plus,
  Settings2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  actionPlan,
  coachTodos,
  profileSnapshot,
  sourceLabels,
  type Todo,
  type TodoSource,
} from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** System tasks: drawn from the plan, plus coach suggestions and quick wins. */
const seedTodos: Todo[] = [
  ...actionPlan.flatMap((phase) =>
    phase.items.map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.description,
      source: "plan" as const,
      phase: phase.label,
      effort: item.effort,
      resource: item.resource,
      done: item.done,
    })),
  ),
  ...coachTodos,
  ...profileSnapshot.quickWins.map((w, i) => ({
    id: `win-${i}`,
    title: w,
    source: "coach" as const,
    effort: "Làm được ngay",
    done: false,
  })),
];

const sources: TodoSource[] = ["plan", "coach", "self"];

function SourceDot({ source }: { source: TodoSource }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        source === "plan" && "bg-foreground",
        source === "coach" && "bg-info",
        source === "self" && "bg-muted-foreground/50",
      )}
    />
  );
}

/** Empty tray — hand-drawn to avoid pulling in an illustration library for one image. */
function EmptyTray() {
  return (
    <svg
      viewBox="0 0 96 76"
      fill="none"
      aria-hidden
      className="size-24 text-muted-foreground/35"
    >
      <path
        d="M8 30 L20 8 h56 l12 22 v34a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M8 30h22a4 4 0 0 1 4 4 4 4 0 0 0 4 4h20a4 4 0 0 0 4-4 4 4 0 0 1 4-4h22"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function TodoPage() {
  const [todos, setTodos] = React.useState<Todo[]>(seedTodos);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [visible, setVisible] = React.useState<TodoSource[]>(sources);
  const [showDone, setShowDone] = React.useState(false);

  const open = todos.filter((t) => !t.done && visible.includes(t.source));
  const done = todos.filter((t) => t.done && visible.includes(t.source));
  const selected = todos.find((t) => t.id === selectedId) ?? null;

  function toggle(id: string) {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
    const t = todos.find((x) => x.id === id);
    if (t && !t.done) toast.success(`Đã xong: ${t.title}`);
  }

  function addTodo(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    const todo: Todo = {
      id: `self-${Date.now()}`,
      title,
      source: "self",
      done: false,
    };
    setTodos((prev) => [todo, ...prev]);
    setDraft("");
    setSelectedId(todo.id);
  }

  function toggleSource(s: TodoSource) {
    setVisible((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  return (
    <div className="flex h-full">
      {/* Task rail — left column, like Linear's Inbox */}
      <div className="flex w-full shrink-0 flex-col border-r md:w-[22rem] lg:w-[24rem]">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <h2 className="text-sm font-medium">Việc cần làm</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {open.length}
          </span>
          <div className="ml-auto flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Lọc theo nguồn"
                  className="text-muted-foreground"
                >
                  <ListFilter />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-muted-foreground">
                  Nguồn việc
                </DropdownMenuLabel>
                {sources.map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s}
                    checked={visible.includes(s)}
                    onCheckedChange={() => toggleSource(s)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {sourceLabels[s]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Tuỳ chọn hiển thị"
                  className="text-muted-foreground"
                >
                  <Settings2 />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuCheckboxItem
                  checked={showDone}
                  onCheckedChange={() => setShowDone((v) => !v)}
                  onSelect={(e) => e.preventDefault()}
                >
                  Hiện việc đã xong
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Add your own task right here, without opening another screen. */}
        <form onSubmit={addTodo} className="shrink-0 border-b px-3 py-2">
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 focus-within:bg-muted/60">
            <Plus className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Thêm việc của bạn…"
              aria-label="Thêm việc của bạn"
              className="min-h-6 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
            />
          </div>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {open.length === 0 && done.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Không có việc nào khớp bộ lọc.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {open.map((t) => (
                <TodoRow
                  key={t.id}
                  todo={t}
                  active={t.id === selectedId}
                  onSelect={() => setSelectedId(t.id)}
                  onToggle={() => toggle(t.id)}
                />
              ))}
            </ul>
          )}

          {showDone && done.length > 0 && (
            <>
              <p className="border-y bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground">
                Đã xong · {done.length}
              </p>
              <ul className="divide-y divide-border">
                {done.map((t) => (
                  <TodoRow
                    key={t.id}
                    todo={t}
                    active={t.id === selectedId}
                    onSelect={() => setSelectedId(t.id)}
                    onToggle={() => toggle(t.id)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Detail — right column */}
      <div className="hidden min-w-0 flex-1 flex-col md:flex">
        {selected ? (
          <TodoDetail todo={selected} onToggle={() => toggle(selected.id)} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <EmptyTray />
            <p className="mt-5 text-sm font-medium">Chưa chọn việc nào</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Chọn một việc bên trái để xem chi tiết, hoặc thêm việc của riêng
              bạn ở ô trên cùng.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TodoRow({
  todo,
  active,
  onSelect,
  onToggle,
}: {
  todo: Todo;
  active: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <li
      className={cn(
        "relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40 motion-reduce:transition-none",
        active && "bg-muted/60",
      )}
    >
      <Checkbox
        checked={todo.done}
        onCheckedChange={onToggle}
        aria-label={`Đánh dấu xong: ${todo.title}`}
        className="relative z-10 mt-0.5"
      />
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 text-left outline-none after:absolute after:inset-0 focus-visible:underline focus-visible:underline-offset-4"
      >
        <span
          className={cn(
            "block truncate text-sm",
            todo.done && "text-muted-foreground line-through",
          )}
        >
          {todo.title}
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <SourceDot source={todo.source} />
          {todo.phase ?? sourceLabels[todo.source]}
          {todo.effort && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{todo.effort}</span>
            </>
          )}
        </span>
      </button>
    </li>
  );
}

function TodoDetail({ todo, onToggle }: { todo: Todo; onToggle: () => void }) {
  return (
    <>
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-6">
        <SourceDot source={todo.source} />
        <span className="text-xs text-muted-foreground">
          {todo.phase ?? sourceLabels[todo.source]}
        </span>
        <Button
          size="sm"
          variant={todo.done ? "outline" : "default"}
          onClick={onToggle}
          className="ml-auto"
        >
          {todo.done ? "Bỏ đánh dấu" : "Đánh dấu xong"}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-2xl">
          <h3
            className={cn(
              "text-xl font-semibold tracking-tight text-balance",
              todo.done && "text-muted-foreground line-through",
            )}
          >
            {todo.title}
          </h3>

          {todo.detail && (
            <p className="mt-3 text-[15px] leading-7 text-muted-foreground text-pretty">
              {todo.detail}
            </p>
          )}

          <dl className="mt-6 divide-y divide-border overflow-hidden rounded-xl border bg-card">
            <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-2.5">
              <dt className="text-xs text-muted-foreground">Nguồn</dt>
              <dd className="text-sm">
                <Badge variant="secondary" className="font-normal">
                  {sourceLabels[todo.source]}
                </Badge>
              </dd>
            </div>
            {todo.phase && (
              <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-2.5">
                <dt className="text-xs text-muted-foreground">Giai đoạn</dt>
                <dd className="text-sm">{todo.phase}</dd>
              </div>
            )}
            {todo.effort && (
              <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-2.5">
                <dt className="text-xs text-muted-foreground">Thời lượng</dt>
                <dd className="flex items-center gap-1.5 text-sm">
                  <Clock className="size-3.5 text-muted-foreground" />
                  {todo.effort}
                </dd>
              </div>
            )}
            {todo.resource && (
              <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-2.5">
                <dt className="text-xs text-muted-foreground">Tài nguyên</dt>
                <dd className="flex items-center gap-1.5 text-sm">
                  <BookOpen className="size-3.5 text-muted-foreground" />
                  {todo.resource.provider} · {todo.resource.name}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/coach?q=${encodeURIComponent(`Giúp mình bắt đầu việc: ${todo.title}`)}`}>
                <Sparkles className="size-4" />
                Hỏi coach về việc này
              </Link>
            </Button>
            {todo.source === "plan" && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/plan">
                  Xem trong kế hoạch
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
