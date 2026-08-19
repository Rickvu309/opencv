import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { getProfileFn } from "@/features/profile/queries";
import { runCommand } from "@/ui/run-command";
import {
  emptyProfileDraft,
  linkKinds,
  ProfileView,
  type ProfileConfirm,
  type ProfileDraft,
  type ProfileLinkKind,
} from "@/features/profile/components/profile-view";
import { useState } from "react";

function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function linkUrl(
  links: { kind: ProfileLinkKind; url: string }[] | undefined,
  kind: ProfileLinkKind,
) {
  return links?.find((link) => link.kind === kind)?.url ?? "";
}

export function ProfileScreen() {
  const q = useQuery({ queryKey: ["profile"], queryFn: () => getProfileFn() });
  const navigate = useNavigate();
  const p = q.data?.profile;
  const [edits, setEdits] = useState<Partial<ProfileDraft>>({});
  const [confirm, setConfirm] = useState<ProfileConfirm>(null);

  function patch(next: Partial<ProfileDraft>) {
    setEdits((prev) => ({ ...prev, ...next }));
  }

  const resolved: ProfileDraft = {
    ...emptyProfileDraft,
    name: p?.name ?? "",
    targetRole: p?.targetRole ?? "",
    location: p?.location ?? "",
    timeAvailable: p?.timeAvailable ?? "",
    school: p?.education.school ?? "",
    major: p?.education.major ?? "",
    year: p?.education.year ?? "",
    gpa: p?.education.gpa ?? "",
    courses: (p?.education.courses ?? []).join("\n"),
    linkedin: linkUrl(p?.links, "linkedin"),
    github: linkUrl(p?.links, "github"),
    portfolio: linkUrl(p?.links, "portfolio"),
    ...edits,
  };

  const empty =
    p &&
    !p.name &&
    !p.education.school &&
    p.experience.length === 0 &&
    p.facts.length === 0 &&
    p.links.length === 0;

  async function refresh() {
    await q.refetch();
    setEdits({});
  }

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
              location: p.location,
              timeAvailable: p.timeAvailable,
              education: {
                school: p.education.school,
                major: p.education.major,
                year: p.education.year,
                gpa: p.education.gpa,
                courses: p.education.courses,
              },
              experience: p.experience.map((e) => ({
                id: e.id,
                org: e.org,
                role: e.role,
                dateFrom: e.dateFrom,
                dateTo: e.dateTo,
                detail: e.detail,
              })),
              facts: p.facts.map((f) => ({ id: f.id, label: f.label, value: f.value })),
              links: p.links.map((l) => ({ kind: l.kind, url: l.url })),
            }
          : undefined
      }
      draft={resolved}
      onDraft={patch}
      onSaveIdentity={() => {
        if (!p) return;
        void runCommand("profile.update", {
          name: resolved.name,
          targetRole: resolved.targetRole || null,
          location: resolved.location,
          timeAvailable: resolved.timeAvailable,
        }).then(() => refresh());
      }}
      onSaveEducation={() =>
        void runCommand("profile.setEducation", {
          school: resolved.school,
          major: resolved.major,
          year: resolved.year,
          gpa: resolved.gpa,
          courses: lines(resolved.courses),
        }).then(() => refresh())
      }
      onSaveExperience={() => {
        const input = {
          org: resolved.expOrg,
          role: resolved.expRole,
          dateFrom: resolved.expFrom,
          dateTo: resolved.expTo,
          detail: lines(resolved.expDetail),
        };
        const run = resolved.editingExperienceId
          ? runCommand("profile.updateExperience", {
              id: resolved.editingExperienceId,
              ...input,
            })
          : runCommand("profile.addExperience", input);
        void run.then(() => refresh());
      }}
      onSaveFact={() => {
        const run = resolved.editingFactId
          ? runCommand("profile.updateFact", {
              id: resolved.editingFactId,
              label: resolved.factLabel,
              value: resolved.factValue,
            })
          : runCommand("profile.addFact", {
              label: resolved.factLabel,
              value: resolved.factValue,
            });
        void run.then(() => refresh());
      }}
      onSaveLinks={() => {
        void Promise.all(
          linkKinds.map((kind) => {
            const url = resolved[kind.id].trim();
            if (url) return runCommand("profile.setLink", { kind: kind.id, url });
            return Promise.resolve();
          }),
        ).then(() => refresh());
      }}
      onStartCv={() => void navigate({ to: "/paper" })}
      confirm={confirm}
      onConfirmChange={setConfirm}
      onConfirmRemove={() => {
        if (!confirm) return;
        const run =
          confirm.kind === "experience"
            ? runCommand("profile.removeExperience", { id: confirm.id })
            : confirm.kind === "fact"
              ? runCommand("profile.removeFact", { id: confirm.id })
              : runCommand("profile.removeLink", { kind: confirm.linkKind });
        void run.then(() => {
          setConfirm(null);
          return refresh();
        });
      }}
    />
  );
}
