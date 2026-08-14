"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAppState, useDispatch } from "@/lib/actions/store";
import { letterTargets, openingForPaper, type LetterTarget } from "@/lib/papers/opening";
import { paperKindLabels, type PaperKind } from "@/lib/papers/types";
import { useT } from "@/lib/i18n/use-t";
import { CvEditor } from "./cv-editor";
import { Library } from "./library";
import { PaperEditor } from "./paper-editor";
import type { ArtefactRef, EditorMode } from "./workspace-parts";

export default function CvPage() {
  return (
    <Suspense fallback={null}>
      <MyPaperWorkspace />
    </Suspense>
  );
}

function MyPaperWorkspace() {
  const state = useAppState();
  const { resumes, papers, profile } = state;
  const dispatch = useDispatch();
  const { t, m, locale } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("resume");
  const paperId = searchParams.get("paper");
  const targets = letterTargets(state);

  const editingResume = resumeId
    ? (resumes.find((resume) => resume.id === resumeId) ?? null)
    : null;
  const editingPaper =
    !editingResume && paperId
      ? (papers.find((paper) => paper.id === paperId) ?? null)
      : null;

  const pending = React.useRef<"resume" | "paper" | null>(null);

  React.useEffect(() => {
    if (pending.current !== "resume") return;
    const newest = resumes.at(-1);
    if (!newest) return;
    pending.current = null;
    router.replace(`/cv?resume=${encodeURIComponent(newest.id)}`, {
      scroll: false,
    });
  }, [resumes, router]);

  React.useEffect(() => {
    if (pending.current !== "paper") return;
    const newest = papers.at(-1);
    if (!newest) return;
    pending.current = null;
    router.replace(`/cv?paper=${encodeURIComponent(newest.id)}`, {
      scroll: false,
    });
  }, [papers, router]);

  React.useEffect(() => {
    if (resumeId && !resumes.some((resume) => resume.id === resumeId)) {
      router.replace("/cv", { scroll: false });
    }
  }, [resumeId, resumes, router]);

  React.useEffect(() => {
    if (
      paperId &&
      !editingResume &&
      !papers.some((paper) => paper.id === paperId)
    ) {
      router.replace("/cv", { scroll: false });
    }
  }, [paperId, editingResume, papers, router]);

  const createResume = (fromProfile: boolean) => {
    const role = profile.identity.targetRole.trim();
    pending.current = "resume";
    dispatch(
      "resume.create",
      {
        label: role
          ? t(m.cv.forRole(role))
          : t(m.cv.untitled(resumes.length + 1)),
        ...(role ? { targetRole: role } : {}),
        fromProfile,
      },
      { silent: true },
    );
  };

  const createPaper = (kind: PaperKind) => {
    pending.current = "paper";
    dispatch("paper.create", {
      kind,
      label: paperKindLabels[kind][locale],
    });
  };

  const createFromOpening = (target: LetterTarget) => {
    const label = t(m.papers.forOpening(target.opening.title));
    pending.current = "paper";
    if (target.applicationId) {
      dispatch("application.tailorLetter", {
        id: target.applicationId,
        label,
        targetRole: target.opening.title,
      });
      return;
    }
    dispatch("paper.create", {
      kind: "cover-letter",
      label,
      targetRole: target.opening.title,
    });
  };

  const select = (ref: ArtefactRef) => {
    const href =
      ref.type === "resume"
        ? `/cv?resume=${encodeURIComponent(ref.id)}`
        : `/cv?paper=${encodeURIComponent(ref.id)}`;
    router.replace(href, { scroll: false });
  };

  const switchMode = (mode: EditorMode) => {
    if (mode === "resume") {
      if (editingResume) return;
      const existing = resumes.at(-1);
      if (existing) {
        select({ type: "resume", id: existing.id });
        return;
      }
      createResume(true);
      return;
    }
    if (editingPaper) return;
    const existing =
      papers.find((paper) => paper.kind === "cover-letter") ?? papers.at(-1);
    if (existing) {
      select({ type: "paper", id: existing.id });
      return;
    }
    createPaper("cover-letter");
  };

  if (editingResume) {
    return (
      <CvEditor
        resume={editingResume}
        resumes={resumes}
        papers={papers}
        onSelect={select}
        onCreateResume={createResume}
        onCreatePaper={createPaper}
        onMode={switchMode}
        onBack={() => router.replace("/cv", { scroll: false })}
      />
    );
  }

  if (editingPaper) {
    return (
      <PaperEditor
        paper={editingPaper}
        resumes={resumes}
        papers={papers}
        opening={openingForPaper(state, editingPaper.id)}
        onSelect={select}
        onCreateResume={createResume}
        onCreatePaper={createPaper}
        onMode={switchMode}
        onBack={() => router.replace("/cv", { scroll: false })}
      />
    );
  }

  return (
    <Library
      resumes={resumes}
      papers={papers}
      hasProfile={Boolean(profile.identity.name)}
      targets={targets}
      onOpenResume={(id) =>
        router.push(`/cv?resume=${encodeURIComponent(id)}`)
      }
      onOpenPaper={(id) => router.push(`/cv?paper=${encodeURIComponent(id)}`)}
      onCreateResume={createResume}
      onCreatePaper={createPaper}
      onCreateFromOpening={createFromOpening}
    />
  );
}
