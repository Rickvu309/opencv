"use client";

// The four "about you" sections. Each owns its own draft through useEditable,
// so adding a section means adding a component; not another branch in a
// page-level save(). Empty sections open as the form.

import * as React from "react";
import { Plus, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EditableSection, Field, Row, useEditable } from "./editable";
import type { AppState, Experience } from "@/lib/actions/types";
import { matchesMsg } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/use-t";
import {
  contextDraft,
  contextKeys,
  filledContextRows,
} from "@/lib/profile/context-draft";

type Profile = AppState["profile"];

const blankExperience: Experience = { title: "", org: "", period: "", detail: "" };

export function IdentitySection({
  identity,
  onSave,
}: {
  identity: Profile["identity"];
  onSave: (v: Profile["identity"]) => void;
}) {
  const { t, m } = useT();
  const isEmpty = !identity.name.trim();
  const e = useEditable({
    value: identity,
    isEmpty,
    validate: (d) =>
      !d.name.trim()
        ? t(m.profile.identityNameRequired)
        : !d.targetRole.trim()
          ? t(m.profile.identityRoleRequired)
          : null,
    onSave,
  });
  const showInvalid = Boolean(e.error);

  return (
    <EditableSection
      title={t(m.profile.identity)}
      hint={isEmpty || e.editing ? t(m.profile.identityHint) : undefined}
      editable={e}
      isEmpty={isEmpty}
    >
      {e.editing ? (
        <div className="grid max-w-md gap-4">
          <Field
            id="p-name"
            label={t(m.profile.fullName)}
            autoComplete="name"
            autoFocus
            value={e.draft.name}
            invalid={showInvalid && !e.draft.name.trim()}
            onChange={(v) => e.set({ name: v })}
          />
          <Field
            id="p-role"
            label={t(m.profile.targetRole)}
            autoComplete="organization-title"
            placeholder="Data Analyst"
            value={e.draft.targetRole}
            invalid={showInvalid && !e.draft.targetRole.trim()}
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

const contextPlaceholders = {
  gender: messages.profile.contextGenderPlaceholder,
  birthYear: messages.profile.contextBirthYearPlaceholder,
  certainty: messages.profile.contextCertaintyPlaceholder,
  location: messages.profile.contextLocationPlaceholder,
} as const;

export function ContextSection({
  context,
  onSave,
}: {
  context: Profile["context"];
  onSave: (v: Profile["context"]) => void;
}) {
  const { t, m } = useT();
  const isEmpty = context.length === 0;
  const prepareDraft = React.useCallback(
    (rows: Profile["context"]) => contextDraft(rows),
    [],
  );
  const e = useEditable({
    value: context,
    isEmpty,
    prepareDraft,
    validate: (d) =>
      filledContextRows(d).length === 0 ? t(m.profile.contextNeedOne) : null,
    onSave: (d) => onSave(filledContextRows(d)),
  });

  return (
    <EditableSection
      title={t(m.profile.context)}
      hint={isEmpty || e.editing ? t(m.profile.contextHint) : undefined}
      editable={e}
      isEmpty={isEmpty}
    >
      {e.editing ? (
        <div className="grid max-w-md gap-4">
          {e.draft.map((row, i) => {
            const known = contextKeys.find((key) =>
              matchesMsg(messages.context[key], row.label),
            );
            return (
              <Field
                key={row.label}
                id={`ctx-${i}`}
                label={row.label}
                autoFocus={i === 0}
                placeholder={known ? t(contextPlaceholders[known]) : undefined}
                value={row.value}
                onChange={(v) =>
                  e.replace(
                    e.draft.map((r, j) => (j === i ? { ...r, value: v } : r)),
                  )
                }
              />
            );
          })}
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
  const isEmpty = experience.length === 0;
  const prepareDraft = React.useCallback(
    (rows: Experience[]) => (rows.length === 0 ? [blankExperience] : rows),
    [],
  );
  const e = useEditable<Experience[]>({
    value: experience,
    isEmpty,
    prepareDraft,
    validate: (d) =>
      d.length === 0 || d.some((x) => !x.title.trim() || !x.org.trim())
        ? t(m.profile.experienceRequired)
        : null,
    onSave,
  });

  const addRow = () => e.replace([...e.draft, blankExperience]);
  const compact = e.draft.length === 1;

  return (
    <EditableSection
      title={t(m.profile.experience)}
      hint={isEmpty || e.editing ? t(m.profile.experienceEmptyBody) : undefined}
      editable={e}
      isEmpty={isEmpty}
      meta={
        !isEmpty ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {t(m.profile.itemCount(experience.length))}
          </span>
        ) : undefined
      }
    >
      {e.editing ? (
        <div className="space-y-8">
          <div className={compact ? "grid gap-4" : "space-y-5"}>
            {e.draft.map((x, i) => (
              <ExperienceFields
                key={i}
                index={i}
                value={x}
                boxed={!compact}
                showRemove={!compact || Boolean(x.title || x.org || x.period || x.detail)}
                onChange={(patch) =>
                  e.replace(e.draft.map((y, j) => (j === i ? { ...y, ...patch } : y)))
                }
                onRemove={() => e.replace(e.draft.filter((_, j) => j !== i))}
              />
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="size-3.5" />
            {t(m.profile.experienceAdd)}
          </Button>
        </div>
      ) : (
        <Timeline
          items={experience}
          targetRole={targetRole}
          onAdd={() => e.start([...experience, blankExperience])}
        />
      )}
    </EditableSection>
  );
}

function ExperienceFields({
  index,
  value,
  boxed,
  showRemove,
  onChange,
  onRemove,
}: {
  index: number;
  value: Experience;
  boxed: boolean;
  showRemove: boolean;
  onChange: (patch: Partial<Experience>) => void;
  onRemove: () => void;
}) {
  const { t, m } = useT();
  const fields = (
    <>
      <Field
        id={`exp-title-${index}`}
        label={t(m.profile.experienceRole)}
        placeholder={t(m.cv.entryTitlePlaceholder)}
        value={value.title}
        autoFocus={index === 0}
        onChange={(v) => onChange({ title: v })}
      />
      <Field
        id={`exp-org-${index}`}
        label={t(m.profile.experienceOrg)}
        placeholder={t(m.cv.entryOrgPlaceholder)}
        value={value.org}
        onChange={(v) => onChange({ org: v })}
      />
      <Field
        id={`exp-period-${index}`}
        label={t(m.profile.experiencePeriod)}
        placeholder={t(m.cv.entryPeriodPlaceholder)}
        value={value.period}
        onChange={(v) => onChange({ period: v })}
      />
      <div className="grid gap-1.5">
        <Label htmlFor={`exp-detail-${index}`}>
          {t(m.profile.experienceDetail)}
        </Label>
        <Textarea
          id={`exp-detail-${index}`}
          className="min-h-16"
          placeholder={t(m.cv.entryDetailPlaceholder)}
          value={value.detail}
          onChange={(ev) => onChange({ detail: ev.target.value })}
        />
      </div>
      {showRemove && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-self-start text-muted-foreground"
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
          {t(m.profile.experienceRemove)}
        </Button>
      )}
    </>
  );

  if (!boxed) return <div className="grid gap-4">{fields}</div>;

  return (
    <fieldset className="grid gap-3 rounded-xl border p-3">
      <legend className="px-1 text-xs text-muted-foreground">
        {t(m.profile.experienceEntry(index + 1))}
      </legend>
      {fields}
    </fieldset>
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
      <Button type="button" variant="outline" size="sm" className="mt-5" onClick={onAdd}>
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
  const isEmpty = !education.school.trim();
  const e = useEditable({
    value: education,
    isEmpty,
    validate: (d) => (!d.school.trim() ? t(m.profile.schoolRequired) : null),
    onSave,
  });
  const [newCourse, setNewCourse] = React.useState("");
  const showInvalid = Boolean(e.error);

  return (
    <EditableSection
      title={t(m.profile.education)}
      hint={isEmpty || e.editing ? t(m.profile.educationHint) : undefined}
      editable={e}
      isEmpty={isEmpty}
    >
      {e.editing ? (
        <div className="grid max-w-md gap-4">
          <Field
            id="edu-school"
            label={t(m.profile.school)}
            autoComplete="organization"
            autoFocus
            value={e.draft.school}
            invalid={showInvalid && !e.draft.school.trim()}
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
        <div className="space-y-8">
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
                <Badge key={c} variant="secondary" className="gap-1 pe-1 font-normal">
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
