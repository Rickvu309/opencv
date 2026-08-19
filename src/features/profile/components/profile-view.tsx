import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Band } from "@/ui/band";
import { FieldRow, Section } from "@/ui/section";
import { EmptyState } from "@/ui/empty-state";
import { InfoBlock } from "@/ui/info-block";
import { QueryError } from "@/ui/empty-state";
import { SkeletonSection } from "@/ui/skeleton";

export type ProfileViewData = {
  completeness: number;
  name: string;
  targetRole: string;
  education: { school: string; major: string };
  experience: { id: string; role: string; org: string }[];
};

export function ProfileView({
  pending,
  error,
  onRetry,
  empty,
  data,
  name,
  onName,
  targetRole,
  onTargetRole,
  onSaveIdentity,
  onAddExperience,
}: {
  pending?: boolean;
  error?: boolean;
  onRetry?: () => void;
  empty?: boolean;
  data?: ProfileViewData;
  name: string;
  onName: (value: string) => void;
  targetRole: string;
  onTargetRole: (value: string) => void;
  onSaveIdentity: () => void;
  onAddExperience: () => void;
}) {
  return (
    <div className="max-w-xl">
      <Band title="Profile" />
      {pending ? <SkeletonSection /> : null}
      {error ? <QueryError onRetry={() => onRetry?.()} /> : null}
      {data ? (
        <>
          {empty ? (
            <EmptyState
              kind="first-run"
              title="This is what everything else is written from. Add what you have — school, one job or project, one link."
            />
          ) : null}
          <Section label="Identity">
            <InfoBlock className="tabular-nums">
              {data.completeness} of 100, from what you actually provided.
            </InfoBlock>
            <FieldRow label="Name" htmlFor="name">
              <Input id="name" value={name} onChange={(e) => onName(e.target.value)} />
            </FieldRow>
            <FieldRow label="Target role" htmlFor="role">
              <Input
                id="role"
                value={targetRole}
                onChange={(e) => onTargetRole(e.target.value)}
                placeholder="Analyst, or leave blank if you're not sure"
              />
            </FieldRow>
            <div className="flex justify-end pt-3">
              <Button onClick={onSaveIdentity}>Save identity</Button>
            </div>
          </Section>
          <Section label="Education">
            <p className="text-ink-muted">
              {data.education.school || "Not added yet"} {data.education.major}
            </p>
          </Section>
          <Section label="Experience">
            <div className="space-y-3">
              {data.experience.map((e) => (
                <p key={e.id}>
                  {e.role} · {e.org}
                </p>
              ))}
              <Button variant="outline" onClick={onAddExperience}>
                Add experience
              </Button>
            </div>
          </Section>
        </>
      ) : null}
    </div>
  );
}
