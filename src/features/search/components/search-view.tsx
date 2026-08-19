import { Button, buttonClass } from "@/ui/button";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import { Label } from "@/ui/label";
import { Band } from "@/ui/band";
import { Card } from "@/ui/card";
import { Chip } from "@/ui/chip";
import { Row, RowList } from "@/ui/rows";
import { EmptyState, QueryError } from "@/ui/empty-state";
import { EndOfList } from "@/ui/card";
import { InfoBlock } from "@/ui/info-block";
import { Section } from "@/ui/section";
import { SkeletonRows } from "@/ui/skeleton";
import type { Fit } from "@/features/search/fit";

export type SearchOpening = {
  id: string;
  title: string;
  company: string;
  location?: string;
  fit: Fit | null;
};

export function SearchView({
  pending,
  error,
  onRetry,
  thin,
  openings,
  visible,
  filter,
  onFilter,
  raw,
  onRaw,
  onPaste,
  onSelect,
}: {
  pending?: boolean;
  error?: boolean;
  onRetry?: () => void;
  thin?: boolean;
  openings: SearchOpening[];
  visible: SearchOpening[];
  filter: string;
  onFilter: (value: string) => void;
  raw: string;
  onRaw: (value: string) => void;
  onPaste: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <Band title="Search" />
      {thin ? (
        <EmptyState
          kind="first-run"
          title="Fit needs something to read. Add a fact or set a goal first."
          action={
            <a href="/profile" className={buttonClass()}>
              Open Profile
            </a>
          }
        />
      ) : error ? (
        <QueryError onRetry={() => onRetry?.()} />
      ) : (
        <>
          <Card className="mb-5 max-w-xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onPaste();
              }}
            >
              <Label htmlFor="posting">Paste a posting</Label>
              <Textarea
                id="posting"
                value={raw}
                onChange={(e) => onRaw(e.target.value)}
                placeholder="Paste the role, requirements, and company."
              />
              <div className="mt-3 flex justify-end">
                <Button type="submit" disabled={!raw.trim()}>
                  Score this posting
                </Button>
              </div>
            </form>
          </Card>
          {openings.length ? (
            <div className="mb-4 max-w-xl">
              <Label htmlFor="opening-filter">Filter</Label>
              <Input
                id="opening-filter"
                value={filter}
                onChange={(e) => onFilter(e.target.value)}
                placeholder="Filter by title or company"
              />
            </div>
          ) : null}
          {pending ? <SkeletonRows /> : null}
          {!pending && openings.length === 0 ? (
            <EmptyState
              kind="first-run"
              title="Paste a posting you're looking at, and you'll see how you match."
            />
          ) : null}
          {!pending && openings.length > 0 && visible.length === 0 ? (
            <EmptyState
              kind="filtered"
              title={`Nothing matches “${filter.trim()}”.`}
              action={
                <Button variant="outline" onClick={() => onFilter("")}>
                  Clear the filter
                </Button>
              }
            />
          ) : null}
          {!pending && visible.length > 0 ? (
            <>
              <RowList bleed>
                {visible.map((o) => (
                  <Row
                    key={o.id}
                    label={o.title}
                    chip={
                      o.fit ? (
                        <Chip tone="quiet">
                          Fit {o.fit.met} of {o.fit.total}
                          {o.fit.gap[0] ? ` — misses ${o.fit.gap[0]}` : ""}
                        </Chip>
                      ) : undefined
                    }
                    meta={[o.company, o.location].filter(Boolean).join(" · ")}
                    onSelect={() => onSelect(o.id)}
                  />
                ))}
              </RowList>
              <EndOfList />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

export function OpeningDetailView({
  opening,
  onBack,
  onSave,
  onAskCoach,
}: {
  opening: SearchOpening;
  onBack: () => void;
  onSave: () => void;
  onAskCoach: () => void;
}) {
  const fit = opening.fit;
  return (
    <div>
      <Band
        title={opening.title}
        back={
          <button
            type="button"
            className="inline-flex min-h-[var(--size-touch)] items-center text-[13px] text-ink-muted focus-visible:shadow-[var(--focus-ring)]"
            onClick={onBack}
          >
            Back
          </button>
        }
        meta={opening.company}
        primary={<Button onClick={onSave}>Save to Apply</Button>}
      />
      {fit ? (
        <InfoBlock className="max-w-xl tabular-nums">
          You meet {fit.met} of {fit.total}
          {fit.gap.length ? `; missing ${fit.gap.join(", ")}` : ""}.
        </InfoBlock>
      ) : null}
      {fit?.items.length ? (
        <Section label="Requirements">
          <ul className="space-y-2">
            {fit.items.map((item) => (
              <li key={item.text} className="flex flex-wrap items-center gap-2 text-[15px] leading-[1.6]">
                <Chip tone="status" status={item.met ? "positive" : "attention"}>
                  {item.met ? "Met" : "Missing"}
                </Chip>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      <div className="mt-8">
        <Button variant="ghost" onClick={onAskCoach}>
          Ask the Coach how to close this gap
        </Button>
      </div>
    </div>
  );
}
