"use client";

// Hồ sơ, a workbench you navigate, not a page you scroll.
//
// This file is the shell only: the index rail and which section is showing.
// Each section owns its own editing state (components/profile/sections.tsx),
// and the editing contract itself lives in components/profile/editable.tsx.
//
// All edits dispatch through lib/actions, so the Coach can make the same
// changes through its apply_action tool.

import * as React from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  FileText,
  Folder,
  FolderGit2,
  Globe,
  Mail,
  Plus,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DocumentPanel } from "@/components/profile/document-panel";
import {
  ContextSection,
  EducationSection,
  ExperienceSection,
  IdentitySection,
} from "@/components/profile/sections";
import { useAppState, useDispatch, useTouched } from "@/lib/actions/store";
import { profileWeights, vaultItems, type VaultItemId } from "@/lib/catalog";
import { useT } from "@/lib/i18n/use-t";
import { disclose, discloseInner } from "@/components/ui/disclose";
import { cn } from "@/lib/utils";

const docIcons: Record<VaultItemId, React.ElementType> = {
  cv: FileText,
  "cover-letter": Mail,
  linkedin: Globe,
  portfolio: Folder,
  github: FolderGit2,
};

type SectionId = "identity" | "context" | "experience" | "education" | VaultItemId;
type Entry = {
  id: SectionId;
  label: string;
  meta: string;
  filled: boolean;
  icon?: React.ElementType;
};
type Group = { id: string; label: string; items: Entry[] };

export default function ProfilePage() {
  const { profile } = useAppState();
  const dispatch = useDispatch();
  const touched = useTouched();
  const { t, m, locale } = useT();

  const [selected, setSelected] = React.useState<SectionId>("identity");
  // Narrow screens can't show both panes, so they push: index → section → back.
  const [mobileView, setMobileView] = React.useState<"index" | "panel">("index");
  // Both groups start open; collapsing is for when the vault grows.
  const [openGroups, setOpenGroups] = React.useState<string[]>(["self", "docs"]);
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const docsOf = React.useCallback(
    (kind: VaultItemId) => profile.documents.filter((d) => d.kind === kind),
    [profile.documents],
  );

  // Every point is earned. There used to be a flat base of 46 handed out before
  // the user typed anything, which meant an empty profile opened at 46% and the
  // number could not say what was missing.
  const score =
    (profile.context.length > 0 ? profileWeights.context : 0) +
    (profile.experience.length > 0 ? profileWeights.experience : 0) +
    (profile.education.school ? profileWeights.education : 0) +
    (profile.education.courses.length > 0 ? profileWeights.courses : 0) +
    vaultItems
      .filter((v) => docsOf(v.id).length > 0)
      .reduce((n, v) => n + v.weight, 0);

  const groups: Group[] = [
    {
      id: "self",
      label: t(m.profile.groupSelf),
      items: [
        {
          id: "identity",
          label: t(m.profile.identity),
          meta: profile.identity.name || t(m.common.notAddedYet),
          filled: Boolean(profile.identity.name),
        },
        {
          id: "context",
          label: t(m.profile.context),
          meta: t(m.profile.itemCount(profile.context.length)),
          filled: profile.context.length > 0,
        },
        {
          id: "experience",
          label: t(m.profile.experience),
          meta: t(m.profile.itemCount(profile.experience.length)),
          filled: profile.experience.length > 0,
        },
        {
          id: "education",
          label: t(m.profile.education),
          meta: profile.education.school || t(m.common.notAddedYet),
          filled: Boolean(profile.education.school),
        },
      ],
    },
    {
      id: "docs",
      label: t(m.profile.groupDocuments),
      items: vaultItems.map((v) => {
        const docs = docsOf(v.id);
        const primary = docs.find((d) => d.isPrimary);
        return {
          id: v.id as SectionId,
          label: v.title[locale],
          meta:
            docs.length === 0
              ? t(m.common.notAddedYet)
              : docs.length === 1
                ? (primary?.label ?? t(m.profile.versionCount(1)))
                : t(m.profile.versionCount(docs.length)),
          filled: docs.length > 0,
          icon: docIcons[v.id],
        };
      }),
    },
  ];

  /** Only tabs inside an open group are reachable, collapsed means hidden. */
  const visible = groups
    .filter((g) => openGroups.includes(g.id))
    .flatMap((g) => g.items);

  function onTabKeyDown(e: React.KeyboardEvent) {
    if (!visible.length) return;
    const i = visible.findIndex((s) => s.id === selected);
    let next = -1;
    if (e.key === "ArrowDown") next = (i + 1) % visible.length;
    if (e.key === "ArrowUp") next = (i - 1 + visible.length) % visible.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = visible.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = visible[next].id;
    setSelected(id);
    tabRefs.current[id]?.focus();
  }

  function toggleGroup(id: string) {
    const next = openGroups.includes(id)
      ? openGroups.filter((g) => g !== id)
      : [...openGroups, id];
    setOpenGroups(next);

    // Collapsing the group holding the selection would leave the panel
    // labelled by a hidden tab and put the roving tabindex out of reach.
    // Move the selection to the first tab that's still visible.
    const stillVisible = groups
      .filter((g) => next.includes(g.id))
      .flatMap((g) => g.items);
    if (
      stillVisible.length > 0 &&
      !stillVisible.some((s) => s.id === selected)
    ) {
      setSelected(stillVisible[0].id);
    }
  }

  const selectedVisible = visible.some((s) => s.id === selected);
  const selectedLabel =
    groups.flatMap((g) => g.items).find((s) => s.id === selected)?.label ?? "";
  const missingTotal = groups.flatMap((g) => g.items).filter((s) => !s.filled).length;
  const nextEmptyId = visible
    .slice(visible.findIndex((s) => s.id === selected) + 1)
    .find((s) => !s.filled)?.id
    ?? visible.find((s) => !s.filled && s.id !== selected)?.id;

  const doc = vaultItems.find((v) => v.id === selected);

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
      {/* ── Index rail ─────────────────────────────────────── */}
      <div
        className={cn(
          "w-full shrink-0 flex-col border-e md:flex md:w-[20rem]",
          mobileView === "index"
            ? "flex motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2 motion-safe:duration-[var(--duration-state)] motion-safe:ease-enter"
            : "hidden",
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <span
            aria-hidden
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              profile.identity.name.trim()
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {profile.identity.name.trim() ? (
              profile.identity.name
                .split(" ")
                .slice(-2)
                .map((w) => w[0])
                .join("")
            ) : (
              <User className="size-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {profile.identity.name.trim() || t(m.nav.yourProfile)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {profile.identity.targetRole.trim()
                || (missingTotal > 0
                  ? t(m.profile.missingCount(missingTotal))
                  : t(m.profile.completeness))}
            </p>
          </div>
          <span
            className="text-sm font-semibold tabular-nums"
            aria-label={`${t(m.profile.completeness)} ${score}%`}
          >
            {score}%
          </span>
        </div>

        <div
          role="tablist"
          aria-orientation="vertical"
          aria-label={t(m.profile.sections)}
          onKeyDown={onTabKeyDown}
          className="min-h-0 flex-1 overflow-y-auto py-1"
        >
          {groups.map((g) => {
            const open = openGroups.includes(g.id);
            const missing = g.items.filter((i) => !i.filled).length;
            return (
              <div key={g.id}>
                {/* A disclosure, not a tab: it structures the tablist rather
                    than selecting a panel, so it stays out of the roving
                    tab order and keeps its own Enter/Space semantics. */}
                <h3>
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.id)}
                    aria-expanded={open}
                    aria-controls={`group-${g.id}`}
                    className="flex w-full items-center gap-1.5 px-4 pt-3 pb-1 text-xs text-muted-foreground transition active:translate-y-px outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset motion-reduce:transition-none"
                  >
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        "size-3 transition-transform duration-[var(--duration-state)] ease-snap motion-reduce:transition-none",
                        !open && "-rotate-90",
                      )}
                    />
                    <span>{g.label}</span>
                    {/* The count only appears when collapsed, the rail stays
                        still until you interact with it. */}
                    {!open && missing > 0 && (
                      <span className="ms-auto tabular-nums">
                        {t(m.profile.missingCount(missing))}
                      </span>
                    )}
                  </button>
                </h3>

                <div
                  id={`group-${g.id}`}
                  className={disclose(open)}
                  inert={!open || undefined}
                >
                  <div className={discloseInner}>
                  {g.items.map((s) => {
                    const active = s.id === selected;
                    return (
                      <button
                        key={s.id}
                        ref={(el) => {
                          tabRefs.current[s.id] = el;
                        }}
                        role="tab"
                        id={`tab-${s.id}`}
                        aria-selected={active}
                        aria-controls="profile-panel"
                        tabIndex={active ? 0 : -1}
                        onClick={() => {
                          setSelected(s.id);
                          setMobileView("panel");
                        }}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-4 py-2 text-start transition active:translate-y-px outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset motion-reduce:transition-none",
                          active && "bg-muted",
                          touched.includes(s.id) && "animate-just-changed",
                        )}
                      >
                        {s.icon ? (
                          <s.icon className="size-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <span aria-hidden className="size-3.5 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate text-sm",
                              (active || s.id === nextEmptyId) && "font-medium",
                            )}
                          >
                            {s.label}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {s.meta}
                          </span>
                        </span>
                        {s.filled ? (
                          <Check
                            aria-hidden
                            className="size-3.5 shrink-0 text-success"
                          />
                        ) : (
                          <Plus
                            aria-hidden
                            className={cn(
                              "size-3.5 shrink-0",
                              active || s.id === nextEmptyId
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                          />
                        )}
                        <span className="sr-only">
                          {t(s.filled ? m.common.added : m.common.missing)}
                        </span>
                      </button>
                    );
                  })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Inspector ──────────────────────────────────────── */}
      <div
        role="tabpanel"
        id="profile-panel"
        // Point at the tab only while it's actually in the tree; fall back to
        // a literal name when every group is collapsed.
        aria-labelledby={selectedVisible ? `tab-${selected}` : undefined}
        aria-label={selectedVisible ? undefined : selectedLabel}
        tabIndex={0}
        className={cn(
          "min-w-0 flex-1 flex-col overflow-y-auto outline-none md:flex",
          mobileView === "panel"
            ? "flex motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-2 motion-safe:duration-[var(--duration-state)] motion-safe:ease-enter"
            : "hidden",
          touched.includes(selected) && "animate-just-changed",
        )}
      >
        <div className="shrink-0 border-b px-2 py-1.5 md:hidden">
          <Button variant="ghost" size="sm" onClick={() => setMobileView("index")}>
            <ChevronLeft className="size-4" />
            {t(m.profile.allSections)}
          </Button>
        </div>

        {selected === "identity" && (
          <IdentitySection
            identity={profile.identity}
            onSave={(v) => dispatch("profile.setIdentity", v)}
          />
        )}

        {selected === "context" && (
          <ContextSection
            context={profile.context}
            onSave={(rows) =>
              rows.forEach((r, i) =>
                dispatch("profile.setContext", r, {
                  silent: i < rows.length - 1,
                }),
              )
            }
          />
        )}

        {selected === "experience" && (
          <ExperienceSection
            experience={profile.experience}
            targetRole={profile.identity.targetRole}
            onSave={(next) => {
              // Remove from the end first so earlier indexes stay valid.
              for (let i = profile.experience.length - 1; i >= next.length; i--) {
                dispatch("profile.removeExperience", { index: i }, { silent: true });
              }
              next.forEach((x, index) =>
                dispatch(
                  index < profile.experience.length
                    ? "profile.updateExperience"
                    : "profile.addExperience",
                  index < profile.experience.length ? { index, ...x } : x,
                  { silent: index < next.length - 1 },
                ),
              );
            }}
          />
        )}

        {selected === "education" && (
          <EducationSection
            education={profile.education}
            onSave={(v) => dispatch("profile.setEducation", v)}
            onAddCourse={(name) => dispatch("profile.addCourse", { name })}
            onRemoveCourse={(name) => dispatch("profile.removeCourse", { name })}
          />
        )}

        {doc && (
          <DocumentPanel
            key={doc.id}
            item={doc}
            documents={docsOf(doc.id)}
            onAdd={(d) => dispatch("document.add", { kind: doc.id, ...trim(d) })}
            onUpdate={(id, d) => dispatch("document.update", { id, ...trim(d) })}
            onRemove={(id) => dispatch("document.remove", { id })}
            onSetPrimary={(id) => dispatch("document.setPrimary", { id })}
            onSync={(id) => dispatch("document.sync", { id })}
          />
        )}
      </div>
      </div>
    </div>
  );
}

/** Drop empty optional fields so "" is never stored as a value. */
function trim<T extends Record<string, unknown>>(draft: T) {
  return Object.fromEntries(
    Object.entries(draft).filter(([, v]) => v !== ""),
  ) as Partial<T>;
}
