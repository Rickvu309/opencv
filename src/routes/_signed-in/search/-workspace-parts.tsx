"use client";

import * as React from "react";
import { Bookmark, BookmarkCheck, Trash2 } from "lucide-react";
import { Link } from "@/lib/nav";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppState, useDispatch, useTouched } from "@/lib/actions/store";
import { useT } from "@/lib/i18n/use-t";
import { fitProfileOf, hasProfileFacts, rankOpenings, type OpeningFit } from "@/lib/search/fit";
import {
  excludesOpening,
  matchOpeningField,
  type SearchField,
} from "@/lib/search/match";
import { MIN_POSTING_CHARS, type Opening } from "@/lib/search/types";
import { cn } from "@/lib/utils";

export const SEARCH_SOURCES = ["all", "saved", "seeded"] as const;
export type SearchSource = (typeof SEARCH_SOURCES)[number];

export type RankedOpening = { opening: Opening; fit: OpeningFit };

export function useSearchWorkspace() {
  const state = useAppState();
  const { t, m } = useT();
  const [query, setQuery] = React.useState("");
  const [field, setField] = React.useState<SearchField>("anywhere");
  const [exclude, setExclude] = React.useState("");
  const [city, setCity] = React.useState<string | null>(null);
  const [org, setOrg] = React.useState<string | null>(null);
  const [source, setSource] = React.useState<SearchSource>("all");
  const [composing, setComposing] = React.useState(false);
  const pasteId = React.useId();
  const pasteErrorId = `${pasteId}-error`;
  const touched = useTouched();

  const openings = state.openings;
  const ranked = React.useMemo(
    () => rankOpenings(fitProfileOf(state), openings),
    [state, openings],
  );

  const shown = React.useMemo(() => {
    return ranked.filter(({ opening }) => {
      if (source === "saved" && !opening.saved) return false;
      if (source === "seeded" && !opening.seeded) return false;
      if (city && opening.location !== city) return false;
      if (org && opening.org !== org) return false;
      if (!matchOpeningField(opening, query, field)) return false;
      if (excludesOpening(opening, exclude)) return false;
      return true;
    });
  }, [ranked, source, city, org, query, field, exclude]);

  const facets = React.useMemo(() => collectFacets(openings), [openings]);
  const appliedIds = React.useMemo(
    () => new Set(state.applications.map((application) => application.openingId)),
    [state.applications],
  );
  const narrowed =
    query.trim().length > 0 ||
    exclude.trim().length > 0 ||
    city !== null ||
    org !== null ||
    source !== "all";
  const clearSearch = React.useCallback(() => {
    setQuery("");
    setExclude("");
    setCity(null);
    setOrg(null);
    setSource("all");
  }, []);

  return {
    query,
    setQuery,
    field,
    setField,
    exclude,
    setExclude,
    city,
    setCity,
    org,
    setOrg,
    source,
    setSource,
    composing,
    setComposing,
    ready: hasProfileFacts(state),
    hasOpenings: openings.length > 0,
    shown,
    cities: facets.cities,
    orgs: facets.orgs,
    appliedIds,
    pasteId,
    pasteErrorId,
    touched,
    narrowed,
    clearSearch,
    t,
    m,
  };
}

export type SearchWorkspaceProps = ReturnType<typeof useSearchWorkspace>;

function collectFacets(openings: readonly Opening[]): {
  cities: string[];
  orgs: string[];
} {
  const cities = new Set<string>();
  const orgs = new Set<string>();
  for (const opening of openings) {
    if (opening.location) cities.add(opening.location);
    if (opening.org) orgs.add(opening.org);
  }
  const byName = (a: string, b: string) => a.localeCompare(b);
  return {
    cities: [...cities].sort(byName),
    orgs: [...orgs].sort(byName),
  };
}

export function ProfileBanner() {
  const { t, m } = useT();

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-4 py-2.5">
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-medium">{t(m.search.emptyProfileTitle)}. </span>
        <span className="text-muted-foreground">{t(m.search.emptyProfileBody)}</span>
      </p>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link href="/profile">{t(m.search.emptyProfileAction)}</Link>
      </Button>
    </div>
  );
}

export function AddOpeningForm({
  inputId,
  errorId,
  onClose,
}: {
  inputId: string;
  errorId: string;
  onClose: () => void;
}) {
  const { t, m } = useT();
  const dispatch = useDispatch();
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const [text, setText] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const invalid = text.trim().length < MIN_POSTING_CHARS;
  const showError = submitted && invalid;

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId} className="text-xs text-muted-foreground">
        {t(m.search.pasteLabel)}
      </Label>
      <Textarea
        ref={inputRef}
        id={inputId}
        value={text}
        autoFocus
        rows={6}
        placeholder={t(m.search.pastePlaceholder)}
        aria-invalid={showError || undefined}
        aria-describedby={showError ? errorId : undefined}
        onChange={(event) => setText(event.target.value)}
        className="text-base md:text-sm"
      />
      {showError && (
        <p id={errorId} className="text-xs text-destructive">
          {t(m.search.pasteTooShort)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => {
            if (invalid) {
              setSubmitted(true);
              inputRef.current?.focus();
              return;
            }
            dispatch("opening.add", { text });
            setText("");
            setSubmitted(false);
            onClose();
          }}
        >
          {t(m.search.addOpening)}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t(m.common.cancel)}
        </Button>
      </div>
    </div>
  );
}

export function OpeningActions({
  opening,
  className,
}: {
  opening: Opening;
  className?: string;
}) {
  const { t, m } = useT();
  const dispatch = useDispatch();

  return (
    <div className={cn("flex shrink-0 items-center gap-1", className)}>
      {opening.seeded && (
        <Badge variant="outline">{t(m.search.filterSeeded)}</Badge>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t(opening.saved ? m.search.unsave : m.search.save)}
        className={cn(
          "transition-colors duration-[var(--duration-press)] ease-[var(--ease-snap)] motion-reduce:transition-none",
          opening.saved ? undefined : "text-muted-foreground",
        )}
        onClick={(event) => {
          event.stopPropagation();
          dispatch(opening.saved ? "opening.unsave" : "opening.save", {
            id: opening.id,
          });
        }}
      >
        {opening.saved ? (
          <BookmarkCheck aria-hidden className="size-3.5" />
        ) : (
          <Bookmark aria-hidden className="size-3.5" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t(m.common.delete)}
        className="text-muted-foreground"
        onClick={(event) => {
          event.stopPropagation();
          dispatch("opening.remove", { id: opening.id });
        }}
      >
        <Trash2 aria-hidden className="size-3.5" />
      </Button>
    </div>
  );
}
