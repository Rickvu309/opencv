import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import { Label } from "@/ui/label";
import { Band } from "@/ui/band";
import { Card } from "@/ui/card";
import { FieldRow, Section } from "@/ui/section";
import { EmptyState, QueryError } from "@/ui/empty-state";
import { InfoBlock } from "@/ui/info-block";
import { SkeletonSection } from "@/ui/skeleton";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import {
  profileCanStartCv,
  profileNextStep,
  type ProfileNextStepId,
} from "@/features/profile/next-step";

export const linkKinds = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "github", label: "GitHub" },
  { id: "portfolio", label: "Portfolio" },
] as const;

export type ProfileLinkKind = (typeof linkKinds)[number]["id"];

export type ProfileViewData = {
  completeness: number;
  name: string;
  targetRole: string;
  location: string;
  timeAvailable: string;
  education: { school: string; major: string; year: string; gpa: string; courses: string[] };
  experience: {
    id: string;
    org: string;
    role: string;
    dateFrom: string;
    dateTo: string;
    detail: string[];
  }[];
  facts: { id: string; label: string; value: string }[];
  links: { kind: ProfileLinkKind; url: string }[];
};

export type ProfileDraft = {
  name: string;
  targetRole: string;
  location: string;
  timeAvailable: string;
  school: string;
  major: string;
  year: string;
  gpa: string;
  courses: string;
  expOrg: string;
  expRole: string;
  expFrom: string;
  expTo: string;
  expDetail: string;
  addingExperience: boolean;
  editingExperienceId: string | null;
  factLabel: string;
  factValue: string;
  addingFact: boolean;
  editingFactId: string | null;
  linkedin: string;
  github: string;
  portfolio: string;
};

export type ProfileConfirm =
  | { kind: "experience"; id: string; label: string }
  | { kind: "fact"; id: string; label: string }
  | { kind: "link"; linkKind: ProfileLinkKind }
  | null;

export const emptyProfileDraft: ProfileDraft = {
  name: "",
  targetRole: "",
  location: "",
  timeAvailable: "",
  school: "",
  major: "",
  year: "",
  gpa: "",
  courses: "",
  expOrg: "",
  expRole: "",
  expFrom: "",
  expTo: "",
  expDetail: "",
  addingExperience: false,
  editingExperienceId: null,
  factLabel: "",
  factValue: "",
  addingFact: false,
  editingFactId: null,
  linkedin: "",
  github: "",
  portfolio: "",
};

export function ProfileView({
  pending,
  error,
  onRetry,
  empty,
  data,
  draft,
  onDraft,
  onSaveIdentity,
  onSaveEducation,
  onSaveExperience,
  onSaveFact,
  onSaveLinks,
  onStartCv,
  confirm,
  onConfirmChange,
  onConfirmRemove,
}: {
  pending?: boolean;
  error?: boolean;
  onRetry?: () => void;
  empty?: boolean;
  data?: ProfileViewData;
  draft: ProfileDraft;
  onDraft: (patch: Partial<ProfileDraft>) => void;
  onSaveIdentity: () => void;
  onSaveEducation: () => void;
  onSaveExperience: () => void;
  onSaveFact: () => void;
  onSaveLinks: () => void;
  onStartCv: () => void;
  confirm: ProfileConfirm;
  onConfirmChange: (confirm: ProfileConfirm) => void;
  onConfirmRemove: () => void;
}) {
  const next = data
    ? profileNextStep({
        empty: Boolean(empty),
        experienceCount: data.experience.length,
        factCount: data.facts.length,
        hasSchool: Boolean(data.education.school),
        linkCount: data.links.length,
      })
    : null;
  const canStartCv = data
    ? profileCanStartCv({
        name: data.name,
        experienceCount: data.experience.length,
        hasSchool: Boolean(data.education.school),
      })
    : false;

  function goTo(id: ProfileNextStepId) {
    if (id === "cv") {
      onStartCv();
      return;
    }
    if (id === "experience") {
      onDraft({ addingExperience: true, editingExperienceId: null });
    }
    if (id === "facts") {
      onDraft({ addingFact: true, editingFactId: null });
    }
    document.getElementById(`profile-${id}`)?.scrollIntoView();
  }

  return (
    <div className="max-w-xl">
      <Band
        title="Profile"
        primary={
          next ? (
            <Button onClick={() => goTo(next.id)}>{next.label}</Button>
          ) : undefined
        }
        secondary={
          canStartCv && next?.id !== "cv" ? (
            <Button variant="ghost" onClick={onStartCv}>
              Start a CV
            </Button>
          ) : undefined
        }
      />
      {pending ? (
        <div className="space-y-8">
          <SkeletonSection />
          <SkeletonSection />
          <SkeletonSection />
        </div>
      ) : null}
      {error ? <QueryError onRetry={() => onRetry?.()} /> : null}
      {data ? (
        <>
          {empty ? (
            <EmptyState
              kind="first-run"
              title="This is what everything else is written from. Add what you have — school, one job or project, one link."
            />
          ) : null}

          <Section id="profile-identity" label="Identity">
            <InfoBlock className="tabular-nums">
              {data.completeness} of 100, from what you actually provided.
            </InfoBlock>
            <FieldRow label="Name" htmlFor="name">
              <Input
                id="name"
                autoComplete="name"
                value={draft.name}
                onChange={(e) => onDraft({ name: e.target.value })}
              />
            </FieldRow>
            <FieldRow label="Target role" htmlFor="role">
              <Input
                id="role"
                value={draft.targetRole}
                onChange={(e) => onDraft({ targetRole: e.target.value })}
                placeholder="Analyst, or leave blank if you're not sure"
              />
            </FieldRow>
            <FieldRow label="Location" htmlFor="location">
              <Input
                id="location"
                value={draft.location}
                onChange={(e) => onDraft({ location: e.target.value })}
                placeholder="Hanoi, or remote"
              />
            </FieldRow>
            <FieldRow label="Time available" htmlFor="time-available">
              <Input
                id="time-available"
                value={draft.timeAvailable}
                onChange={(e) => onDraft({ timeAvailable: e.target.value })}
                placeholder="Evenings, or 20 hours a week"
              />
            </FieldRow>
            <div className="flex justify-end pt-3">
              <Button variant="outline" onClick={onSaveIdentity}>
                Save identity
              </Button>
            </div>
          </Section>

          <Section id="profile-experience" label="Experience">
            {data.experience.length === 0 && !draft.addingExperience ? (
              <InfoBlock>
                One job, project, or shift is enough. Detail lines are results, not duties.
              </InfoBlock>
            ) : null}
            <div className="space-y-3">
              {data.experience.map((item) =>
                draft.editingExperienceId === item.id ? (
                  <ExperienceForm
                    key={item.id}
                    draft={draft}
                    onDraft={onDraft}
                    onSave={onSaveExperience}
                    onCancel={() =>
                      onDraft({
                        addingExperience: false,
                        editingExperienceId: null,
                        expOrg: "",
                        expRole: "",
                        expFrom: "",
                        expTo: "",
                        expDetail: "",
                      })
                    }
                  />
                ) : (
                  <Card key={item.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[15px] font-[510] leading-[1.5]">
                          {item.role} · {item.org}
                        </p>
                        {item.dateFrom || item.dateTo ? (
                          <p className="mt-1 text-[13px] leading-[1.5] text-ink-muted tabular-nums">
                            {[item.dateFrom, item.dateTo].filter(Boolean).join(" – ")}
                          </p>
                        ) : null}
                        {item.detail.map((line, index) => (
                          <p
                            key={`${item.id}-${index}`}
                            className="mt-1 text-[13px] leading-[1.5] text-ink-muted"
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onDraft({
                              addingExperience: false,
                              editingExperienceId: item.id,
                              expOrg: item.org,
                              expRole: item.role,
                              expFrom: item.dateFrom,
                              expTo: item.dateTo,
                              expDetail: item.detail.join("\n"),
                            })
                          }
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onConfirmChange({
                              kind: "experience",
                              id: item.id,
                              label: `${item.role} at ${item.org}`,
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </Card>
                ),
              )}
              {draft.addingExperience ? (
                <ExperienceForm
                  draft={draft}
                  onDraft={onDraft}
                  onSave={onSaveExperience}
                  onCancel={() =>
                    onDraft({
                      addingExperience: false,
                      editingExperienceId: null,
                      expOrg: "",
                      expRole: "",
                      expFrom: "",
                      expTo: "",
                      expDetail: "",
                    })
                  }
                />
              ) : (
                <Button
                  variant="outline"
                  onClick={() =>
                    onDraft({
                      addingExperience: true,
                      editingExperienceId: null,
                      expOrg: "",
                      expRole: "",
                      expFrom: "",
                      expTo: "",
                      expDetail: "",
                    })
                  }
                >
                  Add experience
                </Button>
              )}
            </div>
          </Section>

          <Section id="profile-education" label="Education">
            {!data.education.school ? (
              <InfoBlock>School, major, and year fill this section.</InfoBlock>
            ) : null}
            <FieldRow label="School" htmlFor="school">
              <Input
                id="school"
                value={draft.school}
                onChange={(e) => onDraft({ school: e.target.value })}
                placeholder="The university or school"
              />
            </FieldRow>
            <FieldRow label="Major" htmlFor="major">
              <Input
                id="major"
                value={draft.major}
                onChange={(e) => onDraft({ major: e.target.value })}
                placeholder="What you study"
              />
            </FieldRow>
            <FieldRow label="Year" htmlFor="year">
              <Input
                id="year"
                value={draft.year}
                onChange={(e) => onDraft({ year: e.target.value })}
                placeholder="2026"
              />
            </FieldRow>
            <FieldRow label="GPA" htmlFor="gpa">
              <Input
                id="gpa"
                value={draft.gpa}
                onChange={(e) => onDraft({ gpa: e.target.value })}
                placeholder="Optional"
              />
            </FieldRow>
            <div className="py-2">
              <Label htmlFor="courses">Courses</Label>
              <Textarea
                id="courses"
                value={draft.courses}
                onChange={(e) => onDraft({ courses: e.target.value })}
                placeholder="One course per line"
              />
            </div>
            <div className="flex justify-end pt-3">
              <Button variant="outline" onClick={onSaveEducation}>
                Save education
              </Button>
            </div>
          </Section>

          <Section id="profile-facts" label="Facts">
            {data.facts.length === 0 && !draft.addingFact ? (
              <InfoBlock>
                A labelled fact is anything the Coach should not invent: a language, a tool, a
                constraint.
              </InfoBlock>
            ) : null}
            <div className="space-y-3">
              {data.facts.map((fact) =>
                draft.editingFactId === fact.id ? (
                  <FactForm
                    key={fact.id}
                    draft={draft}
                    onDraft={onDraft}
                    onSave={onSaveFact}
                    onCancel={() =>
                      onDraft({
                        addingFact: false,
                        editingFactId: null,
                        factLabel: "",
                        factValue: "",
                      })
                    }
                  />
                ) : (
                  <Card key={fact.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] leading-[1.5] text-ink-muted">{fact.label}</p>
                        <p className="text-[15px] font-[510] leading-[1.5]">{fact.value}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onDraft({
                              addingFact: false,
                              editingFactId: fact.id,
                              factLabel: fact.label,
                              factValue: fact.value,
                            })
                          }
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onConfirmChange({
                              kind: "fact",
                              id: fact.id,
                              label: fact.label,
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </Card>
                ),
              )}
              {draft.addingFact ? (
                <FactForm
                  draft={draft}
                  onDraft={onDraft}
                  onSave={onSaveFact}
                  onCancel={() =>
                    onDraft({
                      addingFact: false,
                      editingFactId: null,
                      factLabel: "",
                      factValue: "",
                    })
                  }
                />
              ) : (
                <Button
                  variant="outline"
                  onClick={() =>
                    onDraft({
                      addingFact: true,
                      editingFactId: null,
                      factLabel: "",
                      factValue: "",
                    })
                  }
                >
                  Add a fact
                </Button>
              )}
            </div>
          </Section>

          <Section id="profile-links" label="Links">
            {data.links.length === 0 ? (
              <InfoBlock>LinkedIn, GitHub, or a portfolio. One is enough to start.</InfoBlock>
            ) : null}
            {linkKinds.map((kind) => (
              <FieldRow key={kind.id} label={kind.label} htmlFor={`link-${kind.id}`}>
                <div className="flex gap-2">
                  <Input
                    id={`link-${kind.id}`}
                    className="min-w-0 flex-1"
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    value={draft[kind.id]}
                    onChange={(e) => onDraft({ [kind.id]: e.target.value })}
                  />
                  {data.links.some((link) => link.kind === kind.id) ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${kind.label} link`}
                      onClick={() => onConfirmChange({ kind: "link", linkKind: kind.id })}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </FieldRow>
            ))}
            <div className="flex justify-end pt-3">
              <Button variant="outline" onClick={onSaveLinks}>
                Save links
              </Button>
            </div>
          </Section>
        </>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open) onConfirmChange(null);
        }}
        title={confirmTitle(confirm)}
        body={confirmBody(confirm)}
        confirmLabel={confirmLabel(confirm)}
        onConfirm={onConfirmRemove}
      />
    </div>
  );
}

function ExperienceForm({
  draft,
  onDraft,
  onSave,
  onCancel,
}: {
  draft: ProfileDraft;
  onDraft: (patch: Partial<ProfileDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div>
        <Label htmlFor="exp-org">Organisation</Label>
        <Input
          id="exp-org"
          value={draft.expOrg}
          onChange={(e) => onDraft({ expOrg: e.target.value })}
          placeholder="The company or a project"
        />
      </div>
      <div>
        <Label htmlFor="exp-role">Role</Label>
        <Input
          id="exp-role"
          value={draft.expRole}
          onChange={(e) => onDraft({ expRole: e.target.value })}
          placeholder="Intern, or a shift you ran"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="exp-from">From</Label>
          <Input
            id="exp-from"
            value={draft.expFrom}
            onChange={(e) => onDraft({ expFrom: e.target.value })}
            placeholder="Jun 2024"
          />
        </div>
        <div>
          <Label htmlFor="exp-to">To</Label>
          <Input
            id="exp-to"
            value={draft.expTo}
            onChange={(e) => onDraft({ expTo: e.target.value })}
            placeholder="Present, or Aug 2024"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="exp-detail">Results</Label>
        <Textarea
          id="exp-detail"
          value={draft.expDetail}
          onChange={(e) => onDraft({ expDetail: e.target.value })}
          placeholder="One result per line"
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="outline">
          {draft.editingExperienceId ? "Save experience" : "Add experience"}
        </Button>
      </div>
    </form>
  );
}

function FactForm({
  draft,
  onDraft,
  onSave,
  onCancel,
}: {
  draft: ProfileDraft;
  onDraft: (patch: Partial<ProfileDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div>
        <Label htmlFor="fact-label">Label</Label>
        <Input
          id="fact-label"
          value={draft.factLabel}
          onChange={(e) => onDraft({ factLabel: e.target.value })}
          placeholder="Language, or a tool"
        />
      </div>
      <div>
        <Label htmlFor="fact-value">Value</Label>
        <Input
          id="fact-value"
          value={draft.factValue}
          onChange={(e) => onDraft({ factValue: e.target.value })}
          placeholder="Python"
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="outline">
          {draft.editingFactId ? "Save fact" : "Add a fact"}
        </Button>
      </div>
    </form>
  );
}

function confirmTitle(confirm: ProfileConfirm) {
  if (confirm?.kind === "experience") return "Remove this experience?";
  if (confirm?.kind === "fact") return "Remove this fact?";
  if (confirm?.kind === "link") return "Remove this link?";
  return "Remove this?";
}

function confirmBody(confirm: ProfileConfirm) {
  if (confirm?.kind === "experience") {
    return `This removes ${confirm.label} from the profile.`;
  }
  if (confirm?.kind === "fact") {
    return `This removes ${confirm.label} from the profile.`;
  }
  if (confirm?.kind === "link") {
    const label = linkKinds.find((kind) => kind.id === confirm.linkKind)?.label ?? "this";
    return `This removes the ${label} link from the profile.`;
  }
  return "This removes it from the profile.";
}

function confirmLabel(confirm: ProfileConfirm) {
  if (confirm?.kind === "experience") return "Remove experience";
  if (confirm?.kind === "fact") return "Remove fact";
  if (confirm?.kind === "link") return "Remove link";
  return "Remove";
}
