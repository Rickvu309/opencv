import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Band } from "@/ui/band";
import { Card } from "@/ui/card";
import { FieldRow, Section } from "@/ui/section";
import { QueryError } from "@/ui/empty-state";
import { InfoBlock } from "@/ui/info-block";
import { SkeletonSection } from "@/ui/skeleton";
import { ConfirmDialog } from "@/ui/confirm-dialog";

export const linkKinds = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "github", label: "GitHub" },
  { id: "portfolio", label: "Portfolio" },
] as const;

export type ProfileLinkKind = (typeof linkKinds)[number]["id"];

export type ProfileViewData = {
  name: string;
  targetRole: string;
  education: { school: string; major: string; year: string };
  experience: {
    id: string;
    org: string;
    role: string;
    dateFrom: string;
    dateTo: string;
  }[];
  links: { kind: ProfileLinkKind; url: string }[];
};

export type ProfileDraft = {
  name: string;
  targetRole: string;
  school: string;
  major: string;
  year: string;
  addingSchool: boolean;
  expOrg: string;
  expRole: string;
  expFrom: string;
  expTo: string;
  editingExperienceId: string | null;
  linkedin: string;
  github: string;
  portfolio: string;
};

export type ProfileConfirm = { id: string; label: string } | null;

export const emptyProfileDraft: ProfileDraft = {
  name: "",
  targetRole: "",
  school: "",
  major: "",
  year: "",
  addingSchool: false,
  expOrg: "",
  expRole: "",
  expFrom: "",
  expTo: "",
  editingExperienceId: null,
  linkedin: "",
  github: "",
  portfolio: "",
};

export function ProfileView({
  pending,
  error,
  onRetry,
  data,
  draft,
  onDraft,
  onIdentityBlur,
  onEducationBlur,
  onExperienceBlur,
  onLinkBlur,
  onAddSchool,
  onAddExperience,
  confirm,
  onConfirmChange,
  onConfirmRemove,
}: {
  pending?: boolean;
  error?: boolean;
  onRetry?: () => void;
  data?: ProfileViewData;
  draft: ProfileDraft;
  onDraft: (patch: Partial<ProfileDraft>) => void;
  onIdentityBlur: () => void;
  onEducationBlur: () => void;
  onExperienceBlur: () => void;
  onLinkBlur: (kind: ProfileLinkKind) => void;
  onAddSchool: () => void;
  onAddExperience: () => void;
  confirm: ProfileConfirm;
  onConfirmChange: (confirm: ProfileConfirm) => void;
  onConfirmRemove: () => void;
}) {
  const allEmpty =
    data &&
    !data.name &&
    !data.targetRole &&
    !data.education.school &&
    data.experience.length === 0 &&
    data.links.every((link) => !link.url) &&
    !draft.addingSchool &&
    !draft.editingExperienceId;
  const showSchool =
    Boolean(data?.education.school) || draft.addingSchool || Boolean(draft.school.trim());

  return (
    <div className="max-w-xl">
      <Band title="Profile" meta="Paper and Coach read this." />
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
          {allEmpty ? (
            <InfoBlock className="mb-4">Name, school, one job, one link. That's the start.</InfoBlock>
          ) : null}

          <Section label="Identity">
            <FieldRow label="Name" htmlFor="name">
              <Input
                id="name"
                autoComplete="name"
                value={draft.name}
                onChange={(e) => onDraft({ name: e.target.value })}
                onBlur={onIdentityBlur}
              />
            </FieldRow>
            <FieldRow label="Target role" htmlFor="role">
              <Input
                id="role"
                value={draft.targetRole}
                onChange={(e) => onDraft({ targetRole: e.target.value })}
                onBlur={onIdentityBlur}
                placeholder="Analyst, or leave blank"
              />
            </FieldRow>
          </Section>

          <Section label="School">
            {showSchool ? (
              <>
                <FieldRow label="School" htmlFor="school">
                  <Input
                    id="school"
                    value={draft.school}
                    onChange={(e) => onDraft({ school: e.target.value })}
                    onBlur={onEducationBlur}
                    placeholder="The university or school"
                  />
                </FieldRow>
                <FieldRow label="Major" htmlFor="major">
                  <Input
                    id="major"
                    value={draft.major}
                    onChange={(e) => onDraft({ major: e.target.value })}
                    onBlur={onEducationBlur}
                    placeholder="What you study"
                  />
                </FieldRow>
                <FieldRow label="Year" htmlFor="year">
                  <Input
                    id="year"
                    value={draft.year}
                    onChange={(e) => onDraft({ year: e.target.value })}
                    onBlur={onEducationBlur}
                    placeholder="2026"
                  />
                </FieldRow>
              </>
            ) : (
              <Button variant="outline" onClick={onAddSchool}>
                Add school
              </Button>
            )}
          </Section>

          <Section label="Work">
            <div className="space-y-3">
              {data.experience.map((item) =>
                draft.editingExperienceId === item.id ? (
                  <Card key={item.id}>
                    <FieldRow label="Organisation" htmlFor="exp-org">
                      <Input
                        id="exp-org"
                        autoFocus
                        value={draft.expOrg}
                        onChange={(e) => onDraft({ expOrg: e.target.value })}
                        onBlur={onExperienceBlur}
                        placeholder="The company or a project"
                      />
                    </FieldRow>
                    <FieldRow label="Role" htmlFor="exp-role">
                      <Input
                        id="exp-role"
                        value={draft.expRole}
                        onChange={(e) => onDraft({ expRole: e.target.value })}
                        onBlur={onExperienceBlur}
                        placeholder="Intern, or a shift you ran"
                      />
                    </FieldRow>
                    <FieldRow label="From" htmlFor="exp-from">
                      <Input
                        id="exp-from"
                        value={draft.expFrom}
                        onChange={(e) => onDraft({ expFrom: e.target.value })}
                        onBlur={onExperienceBlur}
                        placeholder="Jun 2024"
                      />
                    </FieldRow>
                    <FieldRow label="To" htmlFor="exp-to">
                      <Input
                        id="exp-to"
                        value={draft.expTo}
                        onChange={(e) => onDraft({ expTo: e.target.value })}
                        onBlur={onExperienceBlur}
                        placeholder="Present, or Aug 2024"
                      />
                    </FieldRow>
                  </Card>
                ) : (
                  <Card key={item.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 text-[15px] font-[510] leading-[1.5]">
                        {experienceLabel(item.org, item.role)}
                      </p>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onDraft({
                              editingExperienceId: item.id,
                              expOrg: item.org,
                              expRole: item.role,
                              expFrom: item.dateFrom,
                              expTo: item.dateTo,
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
                              id: item.id,
                              label: experienceLabel(item.org, item.role),
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
              <Button variant="outline" onClick={onAddExperience}>
                Add experience
              </Button>
            </div>
          </Section>

          <Section label="Links">
            {linkKinds.map((kind) => (
              <FieldRow key={kind.id} label={kind.label} htmlFor={`link-${kind.id}`}>
                <Input
                  id={`link-${kind.id}`}
                  inputMode="url"
                  placeholder="https://"
                  value={draft[kind.id]}
                  onChange={(e) => onDraft({ [kind.id]: e.target.value })}
                  onBlur={() => onLinkBlur(kind.id)}
                />
              </FieldRow>
            ))}
          </Section>
        </>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open) onConfirmChange(null);
        }}
        title="Remove this experience?"
        body={
          confirm
            ? `This removes ${confirm.label} from the profile.`
            : "This removes it from the profile."
        }
        confirmLabel="Remove experience"
        onConfirm={onConfirmRemove}
      />
    </div>
  );
}

function experienceLabel(org: string, role: string) {
  const line = [org, role].filter(Boolean).join(" · ");
  return line || "Untitled";
}
