"use client";

import * as React from "react";
import { ChevronDown, Plus, Search as SearchIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDispatch } from "@/lib/actions/store";
import type { Requirement } from "@/lib/catalogue";
import { useT } from "@/lib/i18n/use-t";
import { skillDisplayName } from "@/lib/search/interpret";
import type { SearchField } from "@/lib/search/match";
import { cn } from "@/lib/utils";

import {
  AddOpeningForm,
  OpeningActions,
  ProfileBanner,
  type RankedOpening,
  type SearchSource,
  type SearchWorkspaceProps,
} from "./workspace-parts";

const ANY = "__any__";

export function SearchView(props: SearchWorkspaceProps) {
  const { t, m } = props;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <h1 className="sr-only">{t(m.search.title)}</h1>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
          <p role="status" className="sr-only">
            {t(m.search.resultCount(props.shown.length))}
          </p>
          <SearchChrome {...props} />
          {!props.ready && (
            <div className="mt-4">
              <ProfileBanner />
            </div>
          )}
          <Results {...props} />
        </div>
      </div>
    </div>
  );
}

function SearchChrome(props: SearchWorkspaceProps) {
  const { t, m } = props;

  return (
    <form
      role="search"
      className="flex flex-col gap-2"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="flex min-w-0 overflow-hidden rounded-xl border bg-card">
        <label htmlFor="search-field" className="sr-only">
          {t(m.search.scopeLabel)}
        </label>
        <Select
          value={props.field}
          onValueChange={(value) => props.setField(value as SearchField)}
        >
          <SelectTrigger
            id="search-field"
            size="sm"
            className="h-9 shrink-0 rounded-none border-0 bg-transparent px-3 shadow-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="anywhere">{t(m.search.scopeAnywhere)}</SelectItem>
            <SelectItem value="title">{t(m.search.scopeTitle)}</SelectItem>
            <SelectItem value="org">{t(m.search.scopeOrg)}</SelectItem>
            <SelectItem value="city">{t(m.search.scopeCity)}</SelectItem>
            <SelectItem value="requirements">
              {t(m.search.scopeRequirements)}
            </SelectItem>
          </SelectContent>
        </Select>
        <div className="w-px shrink-0 self-stretch bg-border" />
        <div className="relative min-w-0 flex-1">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <label htmlFor="opportunity-search" className="sr-only">
            {t(m.search.askLabel)}
          </label>
          <Input
            id="opportunity-search"
            name="q"
            type="search"
            value={props.query}
            onChange={(event) => props.setQuery(event.target.value)}
            placeholder={t(m.search.keywordPlaceholder)}
            autoComplete="off"
            className="h-9 rounded-none border-0 bg-transparent ps-8 shadow-none"
          />
        </div>
      </div>

      <div
        role="group"
        aria-label={t(m.search.filterGroup)}
        className="flex flex-wrap items-center gap-1.5"
      >
        {props.cities.length > 0 && (
          <FilterMenu
            label={t(m.search.filterLocation)}
            value={props.city}
            onChange={props.setCity}
            anyLabel={t(m.search.facetAnyCity)}
            options={props.cities}
          />
        )}
        {props.orgs.length > 0 && (
          <FilterMenu
            label={t(m.search.filterCompany)}
            value={props.org}
            onChange={props.setOrg}
            anyLabel={t(m.search.facetAnyOrg)}
            options={props.orgs}
          />
        )}
        <SourceMenu source={props.source} onSource={props.setSource} />
        <div className="flex min-w-40 flex-1 items-center gap-2 sm:max-w-52">
          <label
            htmlFor="opportunity-exclude"
            className="shrink-0 text-xs text-muted-foreground"
          >
            {t(m.search.excludeLabel)}
          </label>
          <Input
            id="opportunity-exclude"
            name="exclude"
            value={props.exclude}
            onChange={(event) => props.setExclude(event.target.value)}
            placeholder={t(m.search.excludePlaceholder)}
            autoComplete="off"
            className="h-7"
          />
        </div>
      </div>
    </form>
  );
}

function FilterMenu({
  label,
  value,
  onChange,
  anyLabel,
  options,
}: {
  label: string;
  value: string | null;
  onChange: (next: string | null) => void;
  anyLabel: string;
  options: string[];
}) {
  const active = value !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={active ? "secondary" : "outline"}
          size="sm"
          aria-label={active ? `${label}: ${value}` : label}
          className={cn(!active && "text-muted-foreground")}
        >
          {active ? value : label}
          <ChevronDown aria-hidden className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        <DropdownMenuRadioGroup
          value={value ?? ANY}
          onValueChange={(next) => onChange(next === ANY ? null : next)}
        >
          <DropdownMenuRadioItem value={ANY}>{anyLabel}</DropdownMenuRadioItem>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {option}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SourceMenu({
  source,
  onSource,
}: {
  source: SearchSource;
  onSource: (next: SearchSource) => void;
}) {
  const { t, m } = useT();
  const label = t(m.search.filterSource);
  const current =
    source === "saved"
      ? t(m.search.filterSaved)
      : source === "seeded"
        ? t(m.search.filterSeeded)
        : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={current ? "secondary" : "outline"}
          size="sm"
          aria-label={current ? `${label}: ${current}` : label}
          className={cn(!current && "text-muted-foreground")}
        >
          {current ?? label}
          <ChevronDown aria-hidden className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-36">
        <DropdownMenuRadioGroup
          value={source}
          onValueChange={(next) => onSource(next as SearchSource)}
        >
          <DropdownMenuRadioItem value="all">
            {t(m.search.filterAll)}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="saved">
            {t(m.search.filterSaved)}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="seeded">
            {t(m.search.filterSeeded)}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Results(props: SearchWorkspaceProps) {
  const { t, m } = props;
  const heading = !props.hasOpenings
    ? t(m.search.noOpeningsTitle)
    : t(m.search.resultCount(props.shown.length));

  return (
    <section className="mt-10" aria-labelledby="search-results-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="search-results-heading"
          className="text-base font-semibold tracking-tight"
        >
          {heading}
        </h2>
        <Button
          type="button"
          variant={!props.hasOpenings ? "default" : "outline"}
          size="sm"
          aria-expanded={props.composing}
          onClick={() => props.setComposing((was) => !was)}
        >
          <Plus aria-hidden className="size-3.5" />
          {t(m.search.addOpening)}
        </Button>
      </div>

      {props.composing && (
        <div className="mt-4 rounded-xl border bg-card px-4 py-3">
          <AddOpeningForm
            inputId={props.pasteId}
            errorId={props.pasteErrorId}
            onClose={() => props.setComposing(false)}
          />
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border bg-card">
        {!props.hasOpenings ? (
          <EmptyState body={t(m.search.noOpeningsBody)} />
        ) : props.shown.length === 0 ? (
          <EmptyState
            title={
              props.query.trim()
                ? t(m.search.noMatches(props.query.trim()))
                : t(m.search.noFilterMatches)
            }
            action={
              props.narrowed ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={props.clearSearch}
                >
                  {t(m.search.resetSearch)}
                </Button>
              ) : null
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {props.shown.map((row) => (
              <li key={row.opening.id}>
                <ResultRow
                  opening={row.opening}
                  fit={row.fit}
                  flash={props.touched.includes(row.opening.id)}
                  applied={props.appliedIds.has(row.opening.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title?: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-6">
      {title && <p className="text-sm font-medium">{title}</p>}
      {body && (
        <p
          className={cn(
            "text-pretty text-sm text-muted-foreground",
            title && "mt-1",
          )}
        >
          {body}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

function ResultRow({
  opening,
  fit,
  flash,
  applied,
}: RankedOpening & {
  flash: boolean;
  applied: boolean;
}) {
  const { t, m } = useT();
  const dispatch = useDispatch();
  const meta = [opening.org, opening.location].filter(Boolean).join(" · ");

  return (
    <article
      className={cn(
        "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between",
        flash && "animate-just-changed bg-muted/30",
      )}
    >
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-medium text-pretty">{opening.title}</h3>
        {meta && (
          <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
        )}
        <FitWhy fit={fit} />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <OpeningActions opening={opening} />
        {applied ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/applications">{t(m.search.inTracker)}</Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              dispatch("application.create", { openingId: opening.id })
            }
          >
            {t(m.search.apply)}
          </Button>
        )}
      </div>
    </article>
  );
}

function FitWhy({
  fit,
}: {
  fit: RankedOpening["fit"];
}) {
  const { t, m } = useT();

  if (fit.total === 0) {
    return (
      <p className="mt-1 text-pretty text-xs leading-5 text-muted-foreground">
        {t(m.search.fitUnknown)}
      </p>
    );
  }

  const have = fit.met[0] ? namedSkill(fit.met[0]) : null;
  const miss = fit.missing[0] ? namedSkill(fit.missing[0]) : null;

  return (
    <p className="mt-1 text-pretty text-xs leading-5 text-muted-foreground">
      <span className="tabular-nums">
        {t(m.search.fitCount(fit.metCount, fit.total))}
      </span>
      {have ? ` ${t(m.search.whyHave(have))}` : null}
      {miss ? ` ${t(m.search.whyMiss(miss))}` : null}
    </p>
  );
}

function namedSkill(requirement: Requirement): string {
  const skill = requirement.skills[0];
  return skill ? skillDisplayName(skill) : requirement.label;
}
