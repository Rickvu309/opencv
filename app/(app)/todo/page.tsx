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

import { type Todo, type TodoSource } from "@/lib/catalog";
import { useT } from "@/lib/i18n/use-t";
import { useAppState, useDispatch } from "@/lib/actions/store";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import type { messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

const sources: TodoSource[] = ["plan", "coach", "self"];

/** One label per source, so the rail, the filter and the detail agree. */
function sourceLabel(m: typeof messages, source: TodoSource) {
  return source === "plan"
    ? m.todo.sourcePlan
    : source === "coach"
      ? m.todo.sourceCoach
      : m.todo.sourceSelf;
}

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

/** Empty tray, hand-drawn to avoid pulling in an illustration library for one image. */
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
  // Todo is a view over two stores, not a third one. Plan work stays in
  // `plan.stages` and is read live; only coach- and self-created tasks live in
  // `todos`. That way ticking a row here and ticking it on the plan are the
  // same act, instead of two copies drifting apart.
  const { todos, plan } = useAppState();
  const dispatch = useDispatch();
  const { t, m } = useT();
  const isMobile = useIsMobile();

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [visible, setVisible] = React.useState<TodoSource[]>(sources);
  const [showDone, setShowDone] = React.useState(false);

  const all: Todo[] = React.useMemo(
    () => [
      ...plan.stages.flatMap((stage) =>
        stage.entries.map((e) => ({
          id: e.id,
          title: e.title,
          detail: e.detail,
          source: "plan" as const,
          phase: stage.label,
          effort: e.effort,
          resource: e.resource,
          done: e.done,
        })),
      ),
      ...todos,
    ],
    [plan, todos],
  );

  const open = all.filter((t) => !t.done && visible.includes(t.source));
  const done = all.filter((t) => t.done && visible.includes(t.source));
  const selected = all.find((t) => t.id === selectedId) ?? null;

  function toggle(id: string) {
    const row = all.find((x) => x.id === id);
    if (!row) return;
    // Each row is toggled through the action that owns it.
    dispatch(row.source === "plan" ? "plan.toggle" : "todo.toggle", { id }, {
      silent: true,
    });
    if (!row.done) toast.success(t(m.todo.completed(row.title)));
  }

  // The reducer mints the id, so the page can only learn it by watching the
  // list. `todo.add` prepends, so the new task is whatever arrives at the top.
  const selectNewest = React.useRef(false);
  React.useEffect(() => {
    if (selectNewest.current && todos[0]) {
      setSelectedId(todos[0].id);
      selectNewest.current = false;
    }
  }, [todos]);

  function addTodo(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    selectNewest.current = true;
    dispatch("todo.add", { title, source: "self" }, { silent: true });
    setDraft("");
  }

  function toggleSource(s: TodoSource) {
    setVisible((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  return (
    <div className="flex h-full">
      {/* Task rail, left column, like Linear's Inbox */}
      <div className="flex w-full shrink-0 flex-col border-r md:w-[22rem] lg:w-[24rem]">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <h2 className="text-sm font-medium">{t(m.todo.heading)}</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {open.length}
          </span>
          <div className="ml-auto flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t(m.todo.filterBySource)}
                  className="text-muted-foreground"
                >
                  <ListFilter />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-muted-foreground">
                  {t(m.todo.sourceHeading)}
                </DropdownMenuLabel>
                {sources.map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s}
                    checked={visible.includes(s)}
                    onCheckedChange={() => toggleSource(s)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {t(sourceLabel(m, s))}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t(m.todo.displayOptions)}
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
                  {t(m.todo.showDone)}
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
              placeholder={t(m.todo.addPlaceholder)}
              aria-label={t(m.todo.addLabel)}
              className="min-h-6 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
            />
          </div>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {open.length === 0 && done.length === 0 ? (
            /* A filter empty state has to offer the way out, or it is a dead
               end: the filter that hid everything is in a menu the user has
               to remember to reopen. */
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium">
                {t(
                  visible.length === sources.length
                    ? m.todo.emptyTitle
                    : m.todo.filterEmptyTitle,
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(
                  visible.length === sources.length
                    ? m.todo.filterEmptyAll
                    : m.todo.filterEmptyFiltered,
                )}
              </p>
              {visible.length !== sources.length && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setVisible(sources)}
                >
                  {t(m.todo.showAllSources)}
                </Button>
              )}
            </div>
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
                {t(m.todo.doneCount(done.length))}
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

      {/* Detail, right column */}
      <div className="hidden min-w-0 flex-1 flex-col md:flex">
        {selected ? (
          <TodoDetail todo={selected} onToggle={() => toggle(selected.id)} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <EmptyTray />
            <p className="mt-5 text-sm font-medium">{t(m.todo.noSelectionTitle)}</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {t(m.todo.noSelectionBody)}
            </p>
          </div>
        )}
      </div>

      {/* There is no second column on a phone, so the same detail arrives as a
          sheet. Without this, tapping a task selected it and showed nothing. */}
      {isMobile && (
        <Sheet
          open={!!selected}
          onOpenChange={(open) => !open && setSelectedId(null)}
        >
          <SheetContent side="bottom" className="h-[80svh] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>{selected?.title ?? t(m.todo.detailTitle)}</SheetTitle>
            </SheetHeader>
            {/* The detail's header row was written for a pane with nothing in
                its top-right; in a sheet the close button lands there, so the
                header needs to keep clear of it. */}
            {selected && (
              <div className="flex h-full flex-col [&>div:first-child]:pr-14">
                <TodoDetail
                  todo={selected}
                  onToggle={() => toggle(selected.id)}
                />
              </div>
            )}
          </SheetContent>
        </Sheet>
      )}
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
  const { t, m } = useT();
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
        aria-label={t(m.plan.markDone(todo.title))}
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
          {todo.phase ?? t(sourceLabel(m, todo.source))}
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
  const { t, m } = useT();
  return (
    <>
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-6">
        <SourceDot source={todo.source} />
        <span className="text-xs text-muted-foreground">
          {todo.phase ?? t(sourceLabel(m, todo.source))}
        </span>
        <Button
          size="sm"
          variant={todo.done ? "outline" : "default"}
          onClick={onToggle}
          className="ml-auto"
        >
          {t(todo.done ? m.todo.markNotDone : m.todo.markDone)}
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
              <dt className="text-xs text-muted-foreground">{t(m.todo.fieldSource)}</dt>
              <dd className="text-sm">
                <Badge variant="secondary" className="font-normal">
                  {t(sourceLabel(m, todo.source))}
                </Badge>
              </dd>
            </div>
            {todo.phase && (
              <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-2.5">
                <dt className="text-xs text-muted-foreground">{t(m.todo.fieldStage)}</dt>
                <dd className="text-sm">{todo.phase}</dd>
              </div>
            )}
            {todo.effort && (
              <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-2.5">
                <dt className="text-xs text-muted-foreground">{t(m.todo.fieldEffort)}</dt>
                <dd className="flex items-center gap-1.5 text-sm">
                  <Clock className="size-3.5 text-muted-foreground" />
                  {todo.effort}
                </dd>
              </div>
            )}
            {todo.resource && (
              <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-2.5">
                <dt className="text-xs text-muted-foreground">{t(m.todo.fieldResource)}</dt>
                <dd className="flex items-center gap-1.5 text-sm">
                  <BookOpen className="size-3.5 text-muted-foreground" />
                  {todo.resource.provider} · {todo.resource.name}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/coach?q=${encodeURIComponent(t(m.todo.askCoachPrompt(todo.title)))}`}
              >
                <Sparkles className="size-4" />
                {t(m.todo.askCoach)}
              </Link>
            </Button>
            {todo.source === "plan" && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/plan">
                  {t(m.todo.openInPlan)}
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
