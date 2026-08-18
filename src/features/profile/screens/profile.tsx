import { useQuery } from "@tanstack/react-query";
import { getProfileFn } from "@/features/profile/queries";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Band } from "@/ui/band";
import { Section } from "@/ui/section";
import { EmptyState } from "@/ui/empty-state";
import { SkeletonSection } from "@/ui/skeleton";
import { useState } from "react";

export function ProfileScreen() {
  const q = useQuery({ queryKey: ["profile"], queryFn: () => getProfileFn() });
  const [name, setName] = useState<string | null>(null);
  const p = q.data?.profile;
  const empty =
    p && !p.name && !p.education.school && p.experience.length === 0 && p.facts.length === 0;

  return (
    <div className="mx-auto max-w-2xl">
      <Band title="Profile" />
      {q.isPending ? <SkeletonSection /> : null}
      {p ? (
        <>
          {empty ? (
            <EmptyState
              kind="first-run"
              title="This is what everything else is written from. Add what you have — school, one job or project, one link."
            />
          ) : null}
          <Section label="Identity">
            <p className="text-[13px] leading-[1.5] text-ink-muted tabular-nums">
              {q.data?.completeness} of 100, from what you actually provided.
            </p>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name ?? p.name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="role">Target role</Label>
              <Input
                id="role"
                defaultValue={p.targetRole ?? ""}
                placeholder="Analyst, or leave blank if you're not sure"
              />
            </div>
            <Button
              onClick={() => {
                const role = (document.getElementById("role") as HTMLInputElement).value;
                void runCommand("profile.update", {
                  name: name ?? p.name,
                  targetRole: role || null,
                }).then(() => q.refetch());
              }}
            >
              Save identity
            </Button>
          </Section>
          <Section label="Education">
            <p className="text-ink-muted">
              {p.education.school || "Not added yet"} {p.education.major}
            </p>
          </Section>
          <Section label="Experience">
            {p.experience.map((e) => (
              <p key={e.id}>
                {e.role} · {e.org}
              </p>
            ))}
            <Button
              variant="outline"
              onClick={() =>
                void runCommand("profile.addExperience", {
                  org: "New organisation",
                  role: "Role",
                  detail: [],
                }).then(() => q.refetch())
              }
            >
              Add experience
            </Button>
          </Section>
        </>
      ) : null}
    </div>
  );
}
