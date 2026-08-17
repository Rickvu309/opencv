import { useQuery } from "@tanstack/react-query";
import { getProfileFn } from "@/features/profile/queries";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { EmptyState } from "@/ui/empty-state";
import { useState } from "react";

export function ProfileScreen() {
  const q = useQuery({ queryKey: ["profile"], queryFn: () => getProfileFn() });
  const [name, setName] = useState<string | null>(null);
  if (!q.data) return <p className="p-8 text-muted-foreground">Loading your profile.</p>;
  const p = q.data.profile;
  const empty =
    !p.name && !p.education.school && p.experience.length === 0 && p.facts.length === 0;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[28px] font-medium">Profile</h1>
      <p className="mt-1 text-muted-foreground">{q.data.completeness} of 100, from what you actually provided.</p>
      {empty ? (
        <EmptyState title="This is what everything else is written from. Add what you have — school, one job or project, one link." />
      ) : null}
      <section className="mt-8 space-y-3">
        <Input
          value={name ?? p.name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
        <Input defaultValue={p.targetRole ?? ""} placeholder="Target role, or leave blank if you're not sure" id="role" />
        <Button
          onClick={() => {
            const role = (document.getElementById("role") as HTMLInputElement).value;
            void runCommand("profile.update", {
              name: name ?? p.name,
              targetRole: role || null,
            }).then(() => q.refetch());
          }}
        >
          Save
        </Button>
      </section>
      <section className="mt-10">
        <h2 className="text-[18px] font-medium">Education</h2>
        <p className="text-muted-foreground">
          {p.education.school || "Not added yet"} {p.education.major}
        </p>
      </section>
      <section className="mt-8">
        <h2 className="text-[18px] font-medium">Experience</h2>
        {p.experience.map((e) => (
          <p key={e.id}>
            {e.role} · {e.org}
          </p>
        ))}
        <Button
          variant="outline"
          className="mt-3"
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
      </section>
    </div>
  );
}
