"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAppState, useDispatch } from "@/lib/actions/store";
import { letterTargets, openingForPaper, type LetterTarget } from "@/lib/paper/opening";
import {
  cvsOf,
  isCvPaper,
  isLetterPaper,
  lettersOf,
  paperTypeLabels,
  type LetterType,
  type PaperType,
} from "@/lib/paper/types";
import { useT } from "@/lib/i18n/use-t";
import { CvEditor } from "./cv-editor";
import { Library } from "./library";
import { PaperEditor } from "./paper-editor";
import type { ArtefactRef, EditorMode } from "./workspace-parts";

export default function PaperPage() {
  return (
    <Suspense fallback={null}>
      <MyPaperWorkspace />
    </Suspense>
  );
}

function hrefFor(id: string) {
  return `/paper?id=${encodeURIComponent(id)}`;
}

function MyPaperWorkspace() {
  const state = useAppState();
  const { paper, profile } = state;
  const dispatch = useDispatch();
  const { t, m } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const targets = letterTargets(state);
  const resumes = cvsOf(paper);
  const letters = lettersOf(paper);

  const editing = id ? (paper.find((item) => item.id === id) ?? null) : null;
  const editingCv = editing && isCvPaper(editing) ? editing : null;
  const editingLetter = editing && isLetterPaper(editing) ? editing : null;

  const pending = React.useRef(false);

  React.useEffect(() => {
    if (!pending.current) return;
    const newest = paper.at(-1);
    if (!newest) return;
    pending.current = false;
    router.replace(hrefFor(newest.id), { scroll: false });
  }, [paper, router]);

  React.useEffect(() => {
    if (id && !paper.some((item) => item.id === id)) {
      router.replace("/paper", { scroll: false });
    }
  }, [id, paper, router]);

  const createResume = (fromProfile: boolean) => {
    const role = profile.identity.targetRole.trim();
    pending.current = true;
    dispatch(
      "paper.create",
      {
        type: "cv" satisfies PaperType,
        label: role
          ? t(m.cv.forRole(role))
          : t(m.cv.untitled(resumes.length + 1)),
        ...(role ? { targetRole: role } : {}),
        fromProfile,
      },
      { silent: true },
    );
  };

  const createPaper = (kind: LetterType) => {
    pending.current = true;
    dispatch("paper.create", {
      type: kind,
      label: paperTypeLabels[kind],
    });
  };

  const createFromOpening = (target: LetterTarget) => {
    const label = t(m.papers.forOpening(target.opening.title));
    pending.current = true;
    if (target.applicationId) {
      dispatch("application.tailorLetter", {
        id: target.applicationId,
        label,
        targetRole: target.opening.title,
      });
      return;
    }
    dispatch("paper.create", {
      type: "letter",
      label,
      targetRole: target.opening.title,
    });
  };

  const select = (ref: ArtefactRef) => {
    router.replace(hrefFor(ref.id), { scroll: false });
  };

  const switchMode = (mode: EditorMode) => {
    if (mode === "resume") {
      if (editingCv) return;
      const existing = resumes.at(-1);
      if (existing) {
        select({ type: "resume", id: existing.id });
        return;
      }
      createResume(true);
      return;
    }
    if (editingLetter) return;
    const existing =
      letters.find((item) => item.type === "letter") ?? letters.at(-1);
    if (existing) {
      select({ type: "paper", id: existing.id });
      return;
    }
    createPaper("letter");
  };

  if (editingCv) {
    return (
      <CvEditor
        resume={editingCv}
        resumes={resumes}
        papers={letters}
        onSelect={select}
        onCreateResume={createResume}
        onCreatePaper={createPaper}
        onMode={switchMode}
        onBack={() => router.replace("/paper", { scroll: false })}
      />
    );
  }

  if (editingLetter) {
    return (
      <PaperEditor
        paper={editingLetter}
        resumes={resumes}
        papers={letters}
        opening={openingForPaper(state, editingLetter.id)}
        onSelect={select}
        onCreateResume={createResume}
        onCreatePaper={createPaper}
        onMode={switchMode}
        onBack={() => router.replace("/paper", { scroll: false })}
      />
    );
  }

  return (
    <Library
      resumes={resumes}
      papers={letters}
      hasProfile={Boolean(profile.identity.name)}
      targets={targets}
      onOpenResume={(openId) => router.push(hrefFor(openId))}
      onOpenPaper={(openId) => router.push(hrefFor(openId))}
      onCreateResume={createResume}
      onCreatePaper={createPaper}
      onCreateFromOpening={createFromOpening}
    />
  );
}
