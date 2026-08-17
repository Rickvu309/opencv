import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { listConversationsFn } from "@/features/coach/queries";
import { useCoachSession } from "@/features/coach/components/session";
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
import { cn } from "@/lib/utils";

const itemClass =
  "flex min-h-11 w-full items-center rounded-[var(--radius-control)] px-3 text-left text-[14px] hover:bg-muted";

function placeState(pathname: string) {
  const paper = pathname === "/paper" || pathname.startsWith("/paper/");
  const proof = pathname === "/proof" || pathname.startsWith("/proof/");
  return {
    paper: paper || proof,
    proof,
    pitch: pathname === "/pitch",
    search: pathname === "/search",
    apply: pathname === "/applications",
  };
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
    <div className="flex h-full min-h-0 flex-col p-3">
      <Button variant="outline" className="w-full" onClick={() => void newConversation()}>
        New conversation
      </Button>

      <nav aria-label="Threads" className="mt-3 min-h-0 flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-1">
          {(convos.data?.conversations ?? []).map((c: { id: string; title: string }) => {
            const active = activeThread === c.id && pathname === "/coach";
            return (
              <li key={c.id} className="flex items-center gap-1">
                <button
                  type="button"
                  title={c.title}
                  onClick={() => void openThread(c.id)}
                  className={cn(itemClass, "min-w-0 flex-1 truncate", active && "bg-muted text-accent")}
                >
                  {c.title}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Actions for ${c.title}`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[14px] hover:bg-muted"
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
          })}
        </ul>
      </nav>

      <nav aria-label="Places" className="mt-4">
        <p className="px-3 text-[13px] text-muted-foreground">Prepare</p>
        <div className="mt-1 flex flex-col gap-1">
          <Link
            to="/paper"
            onClick={onNavigate}
            className={cn(itemClass, places.paper && !places.proof && "bg-muted text-accent", places.proof && "bg-muted")}
            activeProps={{ className: "" }}
          >
            Paper
          </Link>
          <Link
            to="/proof"
            onClick={onNavigate}
            className={cn(itemClass, "pl-6", places.proof && "bg-muted text-accent")}
            activeProps={{ className: "" }}
          >
            Proof
          </Link>
          <Link
            to="/pitch"
            onClick={onNavigate}
            className={cn(itemClass, places.pitch && "bg-muted text-accent")}
            activeProps={{ className: "" }}
          >
            Pitch
          </Link>
        </div>
        <p className="mt-4 px-3 text-[13px] text-muted-foreground">Opportunities</p>
        <div className="mt-1 flex flex-col gap-1">
          <Link
            to="/search"
            onClick={onNavigate}
            className={cn(itemClass, places.search && "bg-muted text-accent")}
            activeProps={{ className: "" }}
          >
            Search
          </Link>
          <Link
            to="/applications"
            onClick={onNavigate}
            className={cn(itemClass, places.apply && "bg-muted text-accent")}
            activeProps={{ className: "" }}
          >
            Apply
          </Link>
        </div>
      </nav>

      <div className="mt-auto pt-4">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(itemClass, "leading-[1.6] break-words")}
            aria-label="Account"
          >
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
          <DialogDescription className="mt-2 text-[14px] text-muted-foreground">
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
