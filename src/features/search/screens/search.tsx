import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { listOpeningsFn } from "@/features/search/queries";
import { useCoachSession } from "@/features/coach/components/session";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import { Band } from "@/ui/band";
import { Row, RowList } from "@/ui/rows";
import { EmptyState } from "@/ui/empty-state";
import { SkeletonRows } from "@/ui/skeleton";
import { useState } from "react";
import type { Fit } from "@/features/search/fit";

type Opening = {
  id: string;
  title: string;
  company: string;
  location?: string;
  fit: Fit | null;
};

function asFit(raw: unknown): Fit | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Fit;
  if (typeof f.met !== "number" || typeof f.total !== "number") return null;
  return {
    met: f.met,
    total: f.total,
    items: Array.isArray(f.items) ? f.items : [],
    gap: Array.isArray(f.gap) ? f.gap : [],
  };
}

export function SearchScreen() {
  const q = useQuery({ queryKey: ["openings"], queryFn: () => listOpeningsFn() });
  const navigate = useNavigate();
  const { openDockWithIntent } = useCoachSession();
  const [raw, setRaw] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const openings: Opening[] = (q.data?.openings ?? []).map((o) => ({
    id: String(o.id),
    title: String(o.title ?? "Opening"),
    company: String(o.company ?? ""),
    location: o.location ? String(o.location) : undefined,
    fit: asFit(o.fit),
  }));
  const visible = filter.trim()
    ? openings.filter((o) =>
        `${o.title} ${o.company} ${o.location ?? ""}`.toLowerCase().includes(filter.trim().toLowerCase()),
      )
    : openings;
  const selected = openings.find((o) => o.id === openId) ?? null;

  async function pastePosting() {
    if (!raw.trim()) return;
    await runCommand("opening.add", { rawText: raw });
    setRaw("");
    await q.refetch();
  }

  async function saveToApply(openingId: string) {
    await runCommand("application.create", { openingId });
    await navigate({ to: "/applications" });
  }

  const queryForm = (
    <form
      className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        void pastePosting();
      }}
    >
      <label htmlFor="posting" className="sr-only">
        Paste a posting
      </label>
      <Textarea
        id="posting"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="Paste a posting"
      />
      <Button type="submit" disabled={!raw.trim()}>
        Score this posting
      </Button>
    </form>
  );

  if (selected) {
    const fit = selected.fit;
    return (
      <div>
        <Band
          title={selected.title}
          back={
            <button
              type="button"
              className="inline-flex min-h-11 items-center text-[13px] text-ink-muted"
              onClick={() => setOpenId(null)}
            >
              Back
            </button>
          }
          meta={selected.company}
          primary={
            <Button onClick={() => void saveToApply(selected.id)}>Save to Apply</Button>
          }
        />
        {fit ? (
          <p className="text-[15px] leading-[1.6] tabular-nums">
            You meet {fit.met} of {fit.total}
            {fit.gap.length ? `; missing ${fit.gap.join(", ")}` : ""}.
          </p>
        ) : null}
        {fit?.items.length ? (
          <ul className="mt-6 space-y-2">
            {fit.items.map((item) => (
              <li key={item.text} className="text-[15px] leading-[1.6]">
                {item.met ? "Met" : "Missing"}: {item.text}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-8">
          <Button
            variant="ghost"
            onClick={() =>
              openDockWithIntent(
                `How do I close the gap for ${selected.title}${selected.company ? ` at ${selected.company}` : ""}?${
                  fit?.gap.length ? ` I'm missing ${fit.gap.join(", ")}.` : ""
                }`,
              )
            }
          >
            Ask the Coach how to close this gap
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Band
        title="Search"
        primary={queryForm}
        filter={
          openings.length ? (
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by title or company"
              aria-label="Filter openings"
            />
          ) : null
        }
      />
      {q.isPending ? <SkeletonRows /> : null}
      {!q.isPending && q.data?.thin ? (
        <EmptyState
          kind="first-run"
          title="Fit needs something to read. Add a fact or set a goal first."
          action={
            <Link to="/profile">
              <Button>Open Profile</Button>
            </Link>
          }
        />
      ) : null}
      {!q.isPending && q.data && !q.data.thin && openings.length === 0 ? (
        <EmptyState
          kind="first-run"
          title="Paste a posting you're looking at, and you'll see how you match."
        />
      ) : null}
      {!q.isPending && q.data && !q.data.thin && openings.length > 0 && visible.length === 0 ? (
        <EmptyState
          kind="filtered"
          title={`Nothing matches “${filter.trim()}”.`}
          action={
            <Button variant="outline" onClick={() => setFilter("")}>
              Clear the filter
            </Button>
          }
        />
      ) : null}
      {!q.isPending && q.data && !q.data.thin && visible.length > 0 ? (
        <RowList>
          {visible.map((o) => (
            <Row
              key={o.id}
              label={o.title}
              meta={
                <span className="flex flex-col items-end gap-0.5 text-right">
                  <span>
                    {[o.company, o.location].filter(Boolean).join(" · ")}
                  </span>
                  {o.fit ? (
                    <span className="tabular-nums">
                      Fit {o.fit.met} of {o.fit.total}
                      {o.fit.gap[0] ? ` — misses ${o.fit.gap[0]}` : ""}.
                    </span>
                  ) : null}
                </span>
              }
              onSelect={() => setOpenId(o.id)}
            />
          ))}
        </RowList>
      ) : null}
    </div>
  );
}
