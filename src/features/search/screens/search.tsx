import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listOpeningsFn } from "@/features/search/queries";
import { useCoachSession } from "@/features/coach/components/session";
import { OpeningDetailView, SearchView, type SearchOpening } from "@/features/search/components/search-view";
import { runCommand } from "@/ui/run-command";
import { useState } from "react";
import type { Fit } from "@/features/search/fit";

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

  const openings: SearchOpening[] = (q.data?.openings ?? []).map((o) => ({
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

  if (selected) {
    const fit = selected.fit;
    return (
      <OpeningDetailView
        opening={selected}
        onBack={() => setOpenId(null)}
        onSave={() => void saveToApply(selected.id)}
        onAskCoach={() =>
          openDockWithIntent(
            `How do I close the gap for ${selected.title}${selected.company ? ` at ${selected.company}` : ""}?${
              fit?.gap.length ? ` I'm missing ${fit.gap.join(", ")}.` : ""
            }`,
          )
        }
      />
    );
  }

  return (
    <SearchView
      pending={q.isPending}
      error={q.isError}
      onRetry={() => void q.refetch()}
      thin={Boolean(q.data?.thin)}
      openings={openings}
      visible={visible}
      filter={filter}
      onFilter={setFilter}
      raw={raw}
      onRaw={setRaw}
      onPaste={() => void pastePosting()}
      onSelect={setOpenId}
    />
  );
}
