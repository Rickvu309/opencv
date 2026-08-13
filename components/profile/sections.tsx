"use client";

// The four "about you" sections. Each owns its own draft through useEditable,
// so adding a section means adding a component; not another branch in a
// page-level save().

import * as React from "react";
import { Plus, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EditableSection, Field, Row, useEditable } from "./editable";
import type { AppState, Experience } from "@/lib/actions/types";
import { useT } from "@/lib/i18n/use-t";

type Profile = AppState["profile"];

export function IdentitySection({
  identity,
  onSave,
}: {
  identity: Profile["identity"];
  onSave: (v: Profile["identity"]) => void;
}) {
  const { t, m } = useT();
  const e = useEditable({
    value: identity,
    validate: (d) =>
      !d.name.trim()
        ? t(m.profile.identityNameRequired)
        : !d.targetRole.trim()
          ? t(m.profile.identityRoleRequired)
          : null,
    onSave,
  });

  return (
    <EditableSection title={t(m.profile.identity)} editable={e}>
      {e.editing ? (
        <div className="grid max-w-md gap-4">
          <Field
            id="p-name"
            label={t(m.profile.fullName)}
            autoFocus
            value={e.draft.name}
            invalid={!e.draft.name.trim()}
            onChange={(v) => e.set({ name: v })}
          />
          <Field
            id="p-role"
            label={t(m.profile.targetRole)}
            placeholder="Data Analyst"
            value={e.draft.targetRole}
            invalid={!e.draft.targetRole.trim()}
            onChange={(v) => e.set({ targetRole: v })}
          />
        </div>
      ) : (
        <dl className="max-w-md divide-y divide-border rounded-lg border">
          <Row label={t(m.profile.fullName)} value={identity.name} />
          <Row label={t(m.profile.aimingFor)} value={identity.targetRole} />
        </dl>
      )}
    </EditableSection>
  );
}

export function ContextSection({
  context,
  onSave,
}: {
  context: Profile["context"];
  onSave: (v: Profile["context"]) => void;
}) {
  const { t, m } = useT();
  const e = useEditable({
    value: context,
    validate: (d) => {
      const blank = d.find((r) => !r.value.trim());
      return blank ? t(m.profile.contextValueRequired(blank.label)) : null;
    },
    onSave,
  });

  return (
    <EditableSection title={t(m.profile.context)} editable={e}>
      {e.editing ? (
        <div className="grid max-w-md gap-4">
          {e.draft.map((row, i) => (
            <Field
              key={row.label}
              id={`ctx-${i}`}
              label={row.label}
              autoFocus={i === 0}
              value={row.value}
              invalid={!row.value.trim()}
              onChange={(v) =>
                e.replace(
                  e.draft.map((r, j) => (j === i ? { ...r, value: v } : r)),
                )
              }
            />
          ))}
        </div>
      ) : (
        <dl className="max-w-md divide-y divide-border rounded-lg border">
          {context.map((r) => (
            <Row key={r.label} label={r.label} value={r.value} />
          ))}
        </dl>
      )}
    </EditableSection>
  );
}

export function ExperienceSection({
  experience,
  targetRole,
  onSave,
}: {
  experience: Experience[];
  targetRole: string;
  onSave: (v: Experience[]) => void;
}) {
  const { t, m } = useT();
  const e = useEditable<Experience[]>({
    value: experience,
    validate: (d) =>
      d.some((x) => !x.title.trim() || !x.org.trim())
        ? t(m.profile.experienceRequired)
        : null,
    onSave,
  });

  const blank: Experience = { title: "", org: "", period: "", detail: "" };
  const addRow = () => e.replace([...e.draft, blank]);

  return (
    <EditableSection
      title={t(m.profile.experience)}
      editable={e}
      meta={
        <span className="text-xs text-muted-foreground tabular-nums">
          {t(m.profile.itemCount(experience.length))}
        </span>
      }
    >
      {e.editing ? (
        <div className="space-y-5">
          {e.draft.map((x, i) => (
            <fieldset key={i} className="grid gap-3 rounded-xl border p-3">
              <legend className="px-1 text-xs text-muted-foreground">
                {t(m.profile.experienceEntry(i + 1))}
              </legend>
              <Field
                id={`exp-title-${i}`}
                label={t(m.profile.experienceRole)}
                placeholder={t(m.cv.entryTitlePlaceholder)}
                value={x.title}
                invalid={!x.title.trim()}
                onChange={(v) =>
                  e.replace(e.draft.map((y, j) => (j === i ? { ...y, title: v } : y)))
                }
              />
              <Field
                id={`exp-org-${i}`}
                label={t(m.profile.experienceOrg)}
                placeholder={t(m.cv.entryOrgPlaceholder)}
                value={x.org}
                invalid={!x.org.trim()}
                onChange={(v) =>
                  e.replace(e.draft.map((y, j) => (j === i ? { ...y, org: v } : y)))
                }
              />
              <Field
                id={`exp-period-${i}`}
                label={t(m.profile.experiencePeriod)}
                placeholder={t(m.cv.entryPeriodPlaceholder)}
                value={x.period}
                onChange={(v) =>
                  e.replace(e.draft.map((y, j) => (j === i ? { ...y, period: v } : y)))
                }
              />
              <div className="grid gap-1.5">
                <Label htmlFor={`exp-detail-${i}`}>
                  {t(m.profile.experienceDetail)}
                </Label>
                <Textarea
                  id={`exp-detail-${i}`}
                  className="min-h-16"
                  placeholder={t(m.cv.entryDetailPlaceholder)}
                  value={x.detail}
                  onChange={(ev) =>
                    e.replace(
                      e.draft.map((y, j) =>
                        j === i ? { ...y, detail: ev.target.value } : y,
                      ),
                    )
                  }
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="justify-self-start text-muted-foreground"
                onClick={() => e.replace(e.draft.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-3.5" />
                {t(m.profile.experienceRemove)}
              </Button>
            </fieldset>
          ))}
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="size-3.5" />
            {t(m.profile.experienceAdd)}
          </Button>
        </div>
      ) : (
        <Timeline
          items={experience}
          targetRole={targetRole}
          onAdd={() => e.start([...experience, blank])}
        />
      )}
    </EditableSection>
  );
}

/**
 * Experience as a timeline. Chronology is the point: thin history looks thin,
 * and the line ends at where you're going rather than at the last job.
 */
function Timeline({
  items,
  targetRole,
  onAdd,
}: {
  items: Experience[];
  targetRole: string;
  onAdd: () => void;
}) {
  const { t, m } = useT();
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-4 py-10 text-center">
        <p className="text-sm font-medium">{t(m.profile.experienceEmptyTitle)}</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground text-pretty">
          {t(m.profile.experienceEmptyBody)}
        </p>
        <Button size="sm" className="mt-4" onClick={onAdd}>
          <Plus className="size-3.5" />
          {t(m.profile.experienceAdd)}
        </Button>
      </div>
    );
  }

  return (
    <>
      <ol>
        {items.map((x, i) => (
          <li key={`${x.title}-${i}`} className="grid grid-cols-[auto_1fr] gap-x-4">
            <div className="flex flex-col items-center">
              <span
                aria-hidden
                className="mt-1.5 size-2.5 shrink-0 rounded-full bg-muted-foreground/40"
              />
              <span aria-hidden className="w-px flex-1 bg-border" />
            </div>
            <div className="pb-7">
              <p className="text-xs text-muted-foreground tabular-nums">{x.period}</p>
              <p className="mt-0.5 text-sm font-medium">
                {x.title}
                <span className="font-normal text-muted-foreground"> · {x.org}</span>
              </p>
              {x.detail && (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {x.detail}
                </p>
              )}
            </div>
          </li>
        ))}
        <li className="grid grid-cols-[auto_1fr] gap-x-4">
          <div className="flex flex-col items-center">
            <span
              aria-hidden
              className="mt-1.5 size-2.5 shrink-0 rounded-full border-2 border-foreground bg-background"
            />
          </div>
          <p className="text-sm font-medium">{targetRole}</p>
        </li>
      </ol>
      <Button variant="outline" size="sm" className="mt-5" onClick={onAdd}>
        <Plus className="size-3.5" />
        {t(m.profile.experienceAdd)}
      </Button>
    </>
  );
}

export function EducationSection({
  education,
  onSave,
  onAddCourse,
  onRemoveCourse,
}: {
  education: Profile["education"];
  onSave: (v: Profile["education"]) => void;
  onAddCourse: (name: string) => void;
  onRemoveCourse: (name: string) => void;
}) {
  const { t, m } = useT();
  const e = useEditable({
    value: education,
    validate: (d) => (!d.school.trim() ? t(m.profile.schoolRequired) : null),
    onSave,
  });
  const [newCourse, setNewCourse] = React.useState("");

  return (
    <EditableSection title={t(m.profile.education)} editable={e}>
      {e.editing ? (
        <div className="grid max-w-md gap-4">
          <Field
            id="edu-school"
            label={t(m.profile.school)}
            autoFocus
            value={e.draft.school}
            invalid={!e.draft.school.trim()}
            onChange={(v) => e.set({ school: v })}
          />
          <Field
            id="edu-major"
            label={t(m.profile.major)}
            value={e.draft.major}
            onChange={(v) => e.set({ major: v })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="edu-year"
              label={t(m.profile.yearAndGpa)}
              placeholder={t(m.onboarding.year3)}
              value={e.draft.year}
              onChange={(v) => e.set({ year: v })}
            />
            <Field
              id="edu-gpa"
              label={t(m.onboarding.gpa)}
              placeholder={t(m.onboarding.gpaPlaceholder)}
              value={e.draft.gpa}
              onChange={(v) => e.set({ gpa: v })}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <dl className="max-w-md divide-y divide-border rounded-lg border">
            <Row label={t(m.profile.school)} value={education.school} />
            <Row label={t(m.profile.major)} value={education.major} />
            <Row
              label={t(m.profile.yearAndGpa)}
              value={[education.year, education.gpa && `GPA ${education.gpa}`]
                .filter(Boolean)
                .join(" · ")}
            />
          </dl>

          <div>
            <h3 className="text-sm font-medium">{t(m.profile.certificates)}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {education.courses.map((c) => (
                <Badge key={c} variant="secondary" className="gap-1 pr-1 font-normal">
                  {c}
                  <button
                    type="button"
                    aria-label={t(m.profile.removeCertificate(c))}
                    onClick={() => onRemoveCourse(c)}
                    className="relative flex size-4 items-center justify-center rounded-full transition active:translate-y-px outline-none after:absolute after:-inset-2 hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none"
                  >
                    <X aria-hidden className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <form
              className="mt-3 flex max-w-sm items-end gap-2"
              onSubmit={(ev) => {
                ev.preventDefault();
                const name = newCourse.trim();
                if (!name) return;
                onAddCourse(name);
                setNewCourse("");
              }}
            >
              <div className="grid flex-1 gap-1.5">
                <Label htmlFor="new-course">{t(m.profile.addCertificate)}</Label>
                <Input
                  id="new-course"
                  value={newCourse}
                  placeholder={t(m.profile.certificatePlaceholder)}
                  onChange={(ev) => setNewCourse(ev.target.value)}
                />
              </div>
              <Button type="submit" size="sm" disabled={!newCourse.trim()}>
                {t(m.common.add)}
              </Button>
            </form>
          </div>
        </div>
      )}
    </EditableSection>
  );
}
