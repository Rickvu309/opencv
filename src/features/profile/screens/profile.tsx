import { useQuery } from "@tanstack/react-query";
import { getProfileFn } from "@/features/profile/queries";
import { runCommand } from "@/ui/run-command";
import {
  emptyProfileDraft,
  ProfileView,
  type ProfileConfirm,
  type ProfileDraft,
  type ProfileLinkKind,
} from "@/features/profile/components/profile-view";
import { useEffect, useRef, useState } from "react";

const SAVE_MS = 400;

function linkUrl(
  links: { kind: ProfileLinkKind; url: string }[] | undefined,
  kind: ProfileLinkKind,
) {
  return links?.find((link) => link.kind === kind)?.url ?? "";
}

type Pending =
  | { type: "identity"; name: string; targetRole: string | null }
  | { type: "education"; school: string; major: string; year: string }
  | {
      type: "experience";
      id: string;
      org: string;
      role: string;
      dateFrom: string;
      dateTo: string;
      detail: string[];
    }
  | { type: "link"; kind: ProfileLinkKind; url: string };

export function ProfileScreen() {
  const q = useQuery({ queryKey: ["profile"], queryFn: () => getProfileFn() });
  const p = q.data?.profile;
  const [edits, setEdits] = useState<Partial<ProfileDraft>>({});
  const [confirm, setConfirm] = useState<ProfileConfirm>(null);
  const timers = useRef<Record<string, number>>({});
  const pending = useRef<Record<string, Pending>>({});

  const resolved: ProfileDraft = {
    ...emptyProfileDraft,
    name: p?.name ?? "",
    targetRole: p?.targetRole ?? "",
    school: p?.education.school ?? "",
    major: p?.education.major ?? "",
    year: p?.education.year ?? "",
    linkedin: linkUrl(p?.links, "linkedin"),
    github: linkUrl(p?.links, "github"),
    portfolio: linkUrl(p?.links, "portfolio"),
    ...edits,
  };
  const resolvedRef = useRef(resolved);
  resolvedRef.current = resolved;
  const profileRef = useRef(p);
  profileRef.current = p;

  useEffect(() => {
    const current = timers.current;
    return () => {
      for (const timer of Object.values(current)) window.clearTimeout(timer);
    };
  }, []);

  function schedule(key: string, payload: Pending) {
    pending.current[key] = payload;
    if (timers.current[key]) window.clearTimeout(timers.current[key]);
    timers.current[key] = window.setTimeout(() => {
      void flush(key);
    }, SAVE_MS);
  }

  async function flush(key: string) {
    if (timers.current[key]) {
      window.clearTimeout(timers.current[key]);
      delete timers.current[key];
    }
    const payload = pending.current[key];
    delete pending.current[key];
    if (payload) await persist(payload);
  }

  async function persist(payload: Pending) {
    if (payload.type === "identity") {
      await runCommand("profile.update", {
        name: payload.name,
        targetRole: payload.targetRole,
      });
    } else if (payload.type === "education") {
      const profile = profileRef.current;
      const blank = !payload.school.trim() && !payload.major.trim() && !payload.year.trim();
      if (
        blank &&
        !profile?.education.school &&
        !profile?.education.major &&
        !profile?.education.year
      ) {
        return;
      }
      await runCommand("profile.setEducation", {
        school: payload.school,
        major: payload.major,
        year: payload.year,
        gpa: profile?.education.gpa ?? "",
        courses: profile?.education.courses ?? [],
      });
    } else if (payload.type === "experience") {
      await runCommand("profile.updateExperience", {
        id: payload.id,
        org: payload.org,
        role: payload.role,
        dateFrom: payload.dateFrom,
        dateTo: payload.dateTo,
        detail: payload.detail,
      });
    } else {
      await runCommand("profile.setLink", { kind: payload.kind, url: payload.url });
    }
    await q.refetch();
  }

  function experiencePayload(draft: ProfileDraft): Pending | null {
    if (!draft.editingExperienceId) return null;
    const prev = profileRef.current?.experience.find((item) => item.id === draft.editingExperienceId);
    return {
      type: "experience",
      id: draft.editingExperienceId,
      org: draft.expOrg,
      role: draft.expRole,
      dateFrom: draft.expFrom,
      dateTo: draft.expTo,
      detail: prev?.detail ?? [],
    };
  }

  function patch(next: Partial<ProfileDraft>) {
    const switchingExperience =
      next.editingExperienceId !== undefined &&
      next.editingExperienceId !== resolvedRef.current.editingExperienceId;
    if (switchingExperience) void flush("experience");

    const merged = { ...resolvedRef.current, ...next };
    setEdits((prev) => ({ ...prev, ...next }));

    if ("name" in next || "targetRole" in next) {
      schedule("identity", {
        type: "identity",
        name: merged.name,
        targetRole: merged.targetRole.trim() ? merged.targetRole.trim() : null,
      });
    }
    if ("school" in next || "major" in next || "year" in next) {
      schedule("education", {
        type: "education",
        school: merged.school,
        major: merged.major,
        year: merged.year,
      });
    }
    if (
      !switchingExperience &&
      ("expOrg" in next || "expRole" in next || "expFrom" in next || "expTo" in next)
    ) {
      const payload = experiencePayload(merged);
      if (payload) schedule("experience", payload);
    }
    for (const kind of ["linkedin", "github", "portfolio"] as const) {
      if (kind in next) schedule(kind, { type: "link", kind, url: merged[kind].trim() });
    }
  }

  return (
    <ProfileView
      pending={q.isPending}
      error={q.isError}
      onRetry={() => void q.refetch()}
      data={
        p
          ? {
              name: p.name,
              targetRole: p.targetRole ?? "",
              education: {
                school: p.education.school,
                major: p.education.major,
                year: p.education.year,
              },
              experience: p.experience.map((item) => ({
                id: item.id,
                org: item.org,
                role: item.role,
                dateFrom: item.dateFrom,
                dateTo: item.dateTo,
              })),
              links: p.links.map((link) => ({ kind: link.kind, url: link.url })),
            }
          : undefined
      }
      draft={resolved}
      onDraft={patch}
      onIdentityBlur={() => void flush("identity")}
      onEducationBlur={() => void flush("education")}
      onExperienceBlur={() => void flush("experience")}
      onLinkBlur={(kind) => void flush(kind)}
      onAddSchool={() => setEdits((prev) => ({ ...prev, addingSchool: true }))}
      onAddExperience={() => {
        void (async () => {
          await flush("experience");
          const { result } = await runCommand<{ id: string }>("profile.addExperience", {
            org: "",
            role: "",
            dateFrom: "",
            dateTo: "",
            detail: [],
          });
          await q.refetch();
          setEdits((prev) => ({
            ...prev,
            editingExperienceId: result.id,
            expOrg: "",
            expRole: "",
            expFrom: "",
            expTo: "",
          }));
        })();
      }}
      onExperienceDone={() => {
        void flush("experience").then(() => {
          setEdits((prev) => ({ ...prev, editingExperienceId: null }));
        });
      }}
      confirm={confirm}
      onConfirmChange={setConfirm}
      onConfirmRemove={() => {
        if (!confirm) return;
        void runCommand("profile.removeExperience", { id: confirm.id }).then(() => {
          setConfirm(null);
          setEdits((prev) =>
            prev.editingExperienceId === confirm.id
              ? { ...prev, editingExperienceId: null }
              : prev,
          );
          return q.refetch();
        });
      }}
    />
  );
}
