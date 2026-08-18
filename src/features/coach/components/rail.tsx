import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { listConversationsFn } from "@/features/coach/queries";
import { useCoachSession } from "@/features/coach/components/session";
import { useRailHighlight } from "@/features/coach/components/rail-highlight";
import { getProfileFn } from "@/features/profile/queries";
import { signOutFn } from "@/features/auth/server";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import {
  Plus,
  MessageSquare,
  FileText,
  BadgeCheck,
  Mic,
  Search,
  Briefcase,
  CircleUser,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Mark } from "@/ui/mark";
import { SkeletonHistory } from "@/ui/skeleton";
import { Truncated } from "@/ui/truncated";

const itemClass =
  "relative z-10 flex min-h-[var(--size-touch)] w-full items-center gap-2 rounded-[var(--radius-control)] px-2 text-left text-[13px] font-[510] text-ink-secondary transition-[color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.97] md:min-h-10";

function PlaceIcon({
  icon: Icon,
  active,
}: {
  icon: typeof FileText;
  active?: boolean;
}) {
  return (
    <Icon
      strokeWidth={1.75}
      className={cn("size-4 shrink-0", active ? "text-ink" : "text-ink-muted")}
      aria-hidden="true"
    />
  );
}

function placeState(pathname: string) {
  const paper = pathname === "/paper" || pathname.startsWith("/paper/");
  const proof = pathname === "/proof" || pathname.startsWith("/proof/");
  return {
    coach: pathname === "/coach",
    paper,
    proof,
    pitch: pathname === "/pitch",
    search: pathname === "/search",
    apply: pathname === "/applications",
  };
}

function groupLabel(iso: string | undefined, now: number) {
  if (!iso) return "Earlier";
  const t = new Date(iso).getTime();
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  if (t >= startToday.getTime() && t <= now) return "Today";
  if (t >= startYesterday.getTime()) return "Yesterday";
  return "Earlier";
}

function railActiveKey(
  pathname: string,
  activeThread: string | null,
  places: ReturnType<typeof placeState>,
) {
  if (pathname === "/coach" && activeThread) return `t:${activeThread}`;
  if (places.coach) return "coach";
  if (places.proof) return "proof";
  if (places.paper) return "paper";
  if (places.pitch) return "pitch";
  if (places.search) return "search";
  if (places.apply) return "apply";
  return null;
}

export function Rail({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search });
  const threadFromUrl =
    pathname === "/coach" && typeof search === "object" && search && "thread" in search
      ? String((search as { thread?: string }).thread ?? "")
      : "";
  const { threadId, setThreadId } = useCoachSession();
  const activeThread = threadFromUrl || threadId;
  const places = placeState(pathname);
  const queryClient = useQueryClient();
  const convos = useQuery({
    queryKey: ["conversations"],
    queryFn: () => listConversationsFn(),
  });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => getProfileFn() });
  const accountName = profile.data?.profile.name?.trim() || "Account";
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const threads = (convos.data?.conversations ?? []) as {
    id: string;
    title: string;
    last_message_at?: string;
  }[];
  const filtered = historyQuery.trim()
    ? threads.filter((c) => c.title.toLowerCase().includes(historyQuery.trim().toLowerCase()))
    : threads;
  const activeKey = railActiveKey(pathname, activeThread, places);
  const highlight = useRailHighlight(
    activeKey,
    `${pathname}:${activeThread}:${filtered.length}`,
  );

  async function closeIfMobile() {
    onNavigate?.();
  }

  async function newConversation() {
    const created = await runCommand<{ id: string }>("conversation.start", {
      title: "New conversation",
    });
    await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    setThreadId(created.result.id);
    await navigate({ to: "/coach", search: { thread: created.result.id } });
    await closeIfMobile();
  }

  async function openThread(id: string) {
    setThreadId(id);
    await navigate({ to: "/coach", search: { thread: id } });
    await closeIfMobile();
  }

  async function saveRename() {
    if (!renameId) return;
    await runCommand("conversation.rename", { id: renameId, title: renameTitle });
    await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    setRenameId(null);
  }

  async function confirmRemove() {
    if (!removeId) return;
    await runCommand("conversation.remove", { id: removeId });
    await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    if (activeThread === removeId) {
      setThreadId(null);
      await navigate({ to: "/coach", search: { thread: undefined } });
      await closeIfMobile();
    }
    setRemoveId(null);
  }

  return (
    <div data-rail className="flex h-full min-h-0 flex-col p-2">
      <p className="mb-1 flex h-10 items-center gap-2 px-2 text-[13px] font-[510]">
        <Mark />
        OpenPath
      </p>
      <button
        type="button"
        data-rail-new
        className="mb-1 flex min-h-[var(--size-touch)] w-full items-center gap-2 rounded-[var(--radius-control)] px-2 text-[13px] font-[510] text-accent transition-[background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-accent-muted active:scale-[0.97] md:min-h-10"
        onClick={() => void newConversation()}
      >
        <span className="min-w-0 flex-1 truncate text-left">New conversation</span>
        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
          <Plus className="size-2.5" strokeWidth={3} aria-hidden="true" />
        </span>
      </button>

      <div
        ref={highlight.navRef}
        data-rail-list
        onMouseLeave={highlight.clearHover}
        className="relative flex min-h-0 flex-1 flex-col"
      >
        <span
          aria-hidden
          data-rail-highlight
          className="pointer-events-none absolute inset-x-0 rounded-[var(--radius-control)] bg-surface-2 motion-reduce:transition-none"
          style={{
            transform: highlight.box ? `translateY(${highlight.box.top}px)` : undefined,
            height: highlight.box?.height ?? 0,
            opacity: highlight.box ? 1 : 0,
            transition:
              "transform var(--duration-base) var(--ease-out), opacity var(--duration-fast) var(--ease-out)",
          }}
        />
        <Link
          ref={highlight.setItemRef("coach")}
          to="/coach"
          search={activeThread ? { thread: activeThread } : { thread: undefined }}
          data-rail-coach
          onClick={onNavigate}
          {...highlight.hoverProps("coach")}
          className={cn(itemClass, places.coach && "font-[590] text-ink")}
          activeProps={{ className: "" }}
        >
          <PlaceIcon icon={MessageSquare} active={places.coach} />
          Coach
        </Link>

        <div
          ref={highlight.scrollRef}
          className="mt-2 flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          <nav
            aria-label="History"
            data-rail-threads
            className={threads.length || convos.isPending ? "min-h-0 shrink-0" : "hidden"}
          >
            <p data-rail-history className="px-2 pb-1 text-[12px] font-[510] text-ink-muted">
              History
            </p>
            {threads.length > 6 ? (
              <div className="px-1 pb-1">
                <Input
                  aria-label="Search conversations"
                  placeholder="Search"
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                  className="min-h-10"
                />
              </div>
            ) : null}
            {convos.isPending ? <SkeletonHistory count={4} /> : null}
            <ul className="flex flex-col gap-px">
              {(["Today", "Yesterday", "Earlier"] as const).flatMap((label) => {
                const group = filtered.filter(
                  (c) => groupLabel(c.last_message_at, Date.now()) === label,
                );
                if (!group.length) return [];
                const heading =
                  threads.length > 4 ? (
                    <li
                      key={`h:${label}`}
                      className="px-2 pt-2 pb-1 text-[12px] text-ink-faint"
                    >
                      {label}
                    </li>
                  ) : null;
                return [
                  heading,
                  ...group.map((c) => {
                    const key = `t:${c.id}`;
                    const active = activeThread === c.id && pathname === "/coach";
                    return (
                      <li
                        key={c.id}
                        ref={highlight.setItemRef(key)}
                        onPointerEnter={(e) => {
                          if (e.pointerType === "mouse") highlight.setHovered(key);
                        }}
                        className="group relative z-10 flex items-center gap-0.5"
                      >
                        <button
                          type="button"
                          title={c.title}
                          onClick={() => void openThread(c.id)}
                          onFocus={highlight.hoverProps(key).onFocus}
                          onBlur={highlight.hoverProps(key).onBlur}
                          className={cn(
                            itemClass,
                            "min-w-0 flex-1",
                            active && "font-[590] text-ink",
                          )}
                        >
                          <Truncated>{c.title}</Truncated>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label={`Actions for ${c.title}`}
                            onFocus={() => highlight.setHovered(key)}
                            className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[13px] opacity-100 hover:bg-surface-3 md:size-10 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100"
                          >
                            ···
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem
                              onSelect={() => {
                                setRenameId(c.id);
                                setRenameTitle(c.title);
                              }}
                            >
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => setRemoveId(c.id)}
                              className="text-destructive"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                    );
                  }),
                ];
              })}
            </ul>
          </nav>

          <nav
            aria-label="Places"
            data-rail-places
            className={cn("shrink-0", threads.length && "mt-3")}
          >
            <p className="px-2 pb-1 text-[12px] font-[510] text-ink-muted">Prepare</p>
            <div className="flex flex-col gap-px">
              <Link
                ref={highlight.setItemRef("paper")}
                to="/paper"
                onClick={onNavigate}
                {...highlight.hoverProps("paper")}
                className={cn(itemClass, places.paper && "font-[590] text-ink")}
                activeProps={{ className: "" }}
              >
                <PlaceIcon icon={FileText} active={places.paper} />
                Paper
              </Link>
              <Link
                ref={highlight.setItemRef("proof")}
                to="/proof"
                onClick={onNavigate}
                {...highlight.hoverProps("proof")}
                className={cn(itemClass, "pl-5", places.proof && "font-[590] text-ink")}
                activeProps={{ className: "" }}
              >
                <PlaceIcon icon={BadgeCheck} active={places.proof} />
                Proof
              </Link>
              <Link
                ref={highlight.setItemRef("pitch")}
                to="/pitch"
                onClick={onNavigate}
                {...highlight.hoverProps("pitch")}
                className={cn(itemClass, places.pitch && "font-[590] text-ink")}
                activeProps={{ className: "" }}
              >
                <PlaceIcon icon={Mic} active={places.pitch} />
                Pitch
              </Link>
            </div>
            <p className="mt-3 px-2 pb-1 text-[12px] font-[510] text-ink-muted">Opportunities</p>
            <div className="flex flex-col gap-px">
              <Link
                ref={highlight.setItemRef("search")}
                to="/search"
                onClick={onNavigate}
                {...highlight.hoverProps("search")}
                className={cn(itemClass, places.search && "font-[590] text-ink")}
                activeProps={{ className: "" }}
              >
                <PlaceIcon icon={Search} active={places.search} />
                Search
              </Link>
              <Link
                ref={highlight.setItemRef("apply")}
                to="/applications"
                onClick={onNavigate}
                {...highlight.hoverProps("apply")}
                className={cn(itemClass, places.apply && "font-[590] text-ink")}
                activeProps={{ className: "" }}
              >
                <PlaceIcon icon={Briefcase} active={places.apply} />
                Apply
              </Link>
            </div>
          </nav>
        </div>
      </div>

      <div className="shrink-0 pt-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              itemClass,
              "overflow-visible leading-[1.6] whitespace-normal break-words hover:bg-surface-2",
            )}
            aria-label="Account"
          >
            <CircleUser className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
            {accountName}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start">
            <DropdownMenuItem
              onSelect={() => {
                void navigate({ to: "/profile" }).then(() => closeIfMobile());
              }}
            >
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                void navigate({ to: "/settings" }).then(() => closeIfMobile());
              }}
            >
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                void signOutFn().then(() => navigate({ to: "/sign-in" }));
              }}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={Boolean(renameId)} onOpenChange={(open) => !open && setRenameId(null)}>
        <DialogContent>
          <DialogTitle>Rename conversation</DialogTitle>
          <DialogDescription className="sr-only">
            Enter a new title for this conversation.
          </DialogDescription>
          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveRename();
            }}
          >
            <Label htmlFor="thread-title">Title</Label>
            <Input
              id="thread-title"
              className="mt-1"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRenameId(null)}>
                Cancel
              </Button>
              <Button type="submit">Save title</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(removeId)} onOpenChange={(open) => !open && setRemoveId(null)}>
        <DialogContent>
          <DialogTitle>Delete this conversation?</DialogTitle>
          <DialogDescription className="mt-2 text-[13px] text-ink-muted">
            This removes the thread. It cannot be undone.
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRemoveId(null)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={() => void confirmRemove()}>
              Delete conversation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
