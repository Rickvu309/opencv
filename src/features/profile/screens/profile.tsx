import { useQuery } from "@tanstack/react-query";
import { getProfileFn } from "@/features/profile/queries";
import { runCommand } from "@/ui/run-command";
import { ProfileView } from "@/features/profile/components/profile-view";
import { useState } from "react";

export function ProfileScreen() {
  const q = useQuery({ queryKey: ["profile"], queryFn: () => getProfileFn() });
  const [name, setName] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState<string | null>(null);
  const p = q.data?.profile;
  const empty =
    p && !p.name && !p.education.school && p.experience.length === 0 && p.facts.length === 0;

  return (
    <ProfileView
      pending={q.isPending}
      error={q.isError}
      onRetry={() => void q.refetch()}
      empty={Boolean(empty)}
      data={
        p
          ? {
              completeness: q.data?.completeness ?? 0,
              name: p.name,
              targetRole: p.targetRole ?? "",
              education: { school: p.education.school, major: p.education.major },
              experience: p.experience.map((e) => ({ id: e.id, role: e.role, org: e.org })),
            }
          : undefined
      }
      name={name ?? p?.name ?? ""}
      onName={setName}
      targetRole={targetRole ?? p?.targetRole ?? ""}
      onTargetRole={setTargetRole}
      onSaveIdentity={() => {
        if (!p) return;
        void runCommand("profile.update", {
          name: name ?? p.name,
          targetRole: (targetRole ?? p.targetRole ?? "") || null,
        }).then(() => q.refetch());
      }}
      onAddExperience={() =>
        void runCommand("profile.addExperience", {
          org: "New organisation",
          role: "Role",
          detail: [],
        }).then(() => q.refetch())
      }
    />
  );
}
