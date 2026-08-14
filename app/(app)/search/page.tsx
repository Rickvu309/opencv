"use client";

import * as React from "react";
import { Bookmark, BookmarkCheck, Check, Circle, Minus, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { useAppState, useDispatch, useTouched } from "@/lib/actions/store";
import { useT } from "@/lib/i18n/use-t";
import { fitProfileOf, hasProfileFacts, rankOpenings, type OpeningFit } from "@/lib/search/fit";
import { MIN_POSTING_CHARS, type Opening } from "@/lib/search/types";
import { cn } from "@/lib/utils";

/**
 * Real postings, ordered by how close this person actually is.
 *
 * The fit read is the point of the screen. Anyone can list jobs; what a student
 * cannot get anywhere else is a straight answer to "have I got a shot, and what
 * would close the gap". So every card leads with met-versus-total and names the
 * missing requirement rather than showing a number they would have to trust.
 */
export default function SearchPage() {
  const state = useAppState();
  const { t, m, locale } = useT();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "saved" | "seeded">("all");
  const touched = useTouched();

  const ranked = React.useMemo(
    () => rankOpenings(fitProfileOf(state), state.openings),
    [state],
  );

  const shown = ranked.filter(({ opening }) => {
    if (filter === "saved" && !opening.saved) return false;
    if (filter === "seeded" && !opening.seeded) return false;
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return [opening.title, opening.org, opening.description]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });

  const ready = hasProfileFacts(state);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t(m.search.title)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(m.search.lead)}</p>
      </header>

      <AddOpening />

      {/* Ranking an empty profile produces a list where everything scores zero,
          ordered by nothing. Saying so is more useful than showing it. */}
      {!ready && (
        <EmptyState
          title={t(m.search.emptyProfileTitle)}
          body={t(m.search.emptyProfileBody)}
          action={{ href: "/profile", label: t(m.search.emptyProfileAction) }}
        />
      )}

      {state.openings.length === 0 ? (
        <EmptyState
          title={t(m.search.noOpeningsTitle)}
          body={t(m.search.noOpeningsBody)}
        />
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(m.search.searchPlaceholder)}
              aria-label={t(m.search.searchPlaceholder)}
              className="h-9 max-w-xs flex-1 text-sm"
            />
            {(["all", "saved", "seeded"] as const).map((value) => (
              <Button
                key={value}
                variant={filter === value ? "secondary" : "ghost"}
                size="sm"
                className={filter === value ? undefined : "text-muted-foreground"}
                onClick={() => setFilter(value)}
              >
                {t(
                  value === "all"
                    ? m.search.filterAll
                    : value === "saved"
                      ? m.search.filterSaved
                      : m.search.filterSeeded,
                )}
              </Button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="mt-4 rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              {t(m.search.noMatches)}
            </p>
          ) : (
            <div className="mt-4 space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-[var(--duration-state)] motion-safe:ease-snap">
              {shown.map(({ opening, fit }) => (
                <OpeningCard
                  key={opening.id}
                  opening={opening}
                  fit={fit}
                  locale={locale}
                  flash={touched.includes(opening.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** The paste box. The whole opening source, for now. */
function AddOpening() {
  const { t, m } = useT();
  const dispatch = useDispatch();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const tooShort = text.trim().length > 0 && text.trim().length < MIN_POSTING_CHARS;

  if (!open) {
    return (
      <div className="mt-6">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-3.5" />
          {t(m.search.addOpening)}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-2 rounded-xl border bg-card p-4">
      <Label className="text-xs text-muted-foreground">
        {t(m.search.pasteLabel)}
      </Label>
      <Textarea
        value={text}
        autoFocus
        rows={6}
        placeholder={t(m.search.pastePlaceholder)}
        onChange={(event) => setText(event.target.value)}
        className="text-sm"
      />
      {tooShort && (
        <p className="text-xs text-destructive">{t(m.search.pasteTooShort)}</p>
      )}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={text.trim().length < MIN_POSTING_CHARS}
          onClick={() => {
            dispatch("opening.add", { text });
            setText("");
            setOpen(false);
          }}
        >
          {t(m.search.addOpening)}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          {t(m.common.cancel)}
        </Button>
      </div>
    </div>
  );
}

function OpeningCard({
  opening,
  fit,
  locale,
  flash,
}: {
  opening: Opening;
  fit: OpeningFit;
  locale: "vi" | "en";
  flash: boolean;
}) {
  const { t, m } = useT();
  const dispatch = useDispatch();
  const [open, setOpen] = React.useState(false);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition-colors duration-[var(--duration-state)] ease-[var(--ease-enter)] motion-reduce:transition-none",
        flash && "bg-muted",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((was) => !was)}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block truncate text-sm font-medium">{opening.title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {[opening.org, opening.location].filter(Boolean).join(" · ")}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {opening.seeded && (
            <Badge variant="outline">{t(m.search.filterSeeded)}</Badge>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t(opening.saved ? m.search.unsave : m.search.save)}
            // Motion joins the icon swap and the colour change rather than
            // carrying the meaning alone: under reduced motion the filled
            // bookmark still says saved.
            className={cn(
              "transition-colors duration-[var(--duration-press)] ease-[var(--ease-snap)] motion-reduce:transition-none",
              opening.saved ? undefined : "text-muted-foreground",
            )}
            onClick={() =>
              dispatch(opening.saved ? "opening.unsave" : "opening.save", {
                id: opening.id,
              })
            }
          >
            {opening.saved ? (
              <BookmarkCheck className="size-3.5" />
            ) : (
              <Bookmark className="size-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t(m.common.delete)}
            className="text-muted-foreground"
            onClick={() => dispatch("opening.remove", { id: opening.id })}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Met versus total, never a score. AC-SEARCH-003.2 is explicit that the
          number shown has to be derived from the requirements themselves. */}
      <div className="mt-2">
        {fit.total > 0 && (
          <span className="mb-1.5 block h-1 w-24 overflow-hidden rounded-full bg-muted">
            <span
              key={`${opening.id}-${fit.metCount}`}
              className="block h-full rounded-full bg-foreground animate-bar-grow motion-reduce:animate-none"
              style={{ width: `${(fit.metCount / fit.total) * 100}%` }}
            />
          </span>
        )}
        <p className="text-xs text-muted-foreground tabular-nums">
          {fit.total === 0
            ? t(m.search.fitUnknown)
            : t(m.search.fitCount(fit.metCount, fit.total))}
        </p>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-border pt-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-[var(--duration-state)] motion-safe:ease-enter">
          <RequirementList
            heading={t(m.search.metHeading)}
            items={fit.met.map((requirement) => requirement.label[locale])}
            icon="met"
          />
          <RequirementList
            heading={t(m.search.missingHeading)}
            items={fit.missing.map((requirement) => requirement.label[locale])}
            icon="missing"
          />
          <RequirementList
            heading={t(m.search.unprovableHeading)}
            items={fit.unprovable.map((requirement) => requirement.label[locale])}
            icon="unprovable"
          />

          {opening.seeded && (
            <p className="text-xs text-muted-foreground">
              {t(m.search.seededNote)}
            </p>
          )}
          {opening.link && (
            <a
              href={opening.link}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-xs underline underline-offset-4"
            >
              {opening.link}
            </a>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => dispatch("application.create", { openingId: opening.id })}
          >
            {t(m.search.apply)}
          </Button>
        </div>
      )}
    </div>
  );
}

function RequirementList({
  heading,
  items,
  icon,
}: {
  heading: string;
  items: string[];
  icon: "met" | "missing" | "unprovable";
}) {
  if (items.length === 0) return null;
  const Icon = icon === "met" ? Check : icon === "missing" ? Circle : Minus;

  return (
    <div>
      <p className="text-xs font-medium">{heading}</p>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li
            key={item}
            className={cn(
              "flex items-baseline gap-2 text-xs",
              icon === "met" ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="mt-0.5 size-3 shrink-0" aria-hidden />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

