"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAppState, useDispatch } from "@/lib/actions/store";
import { openingForPaper } from "@/lib/paper/opening";
import {
  isCvPaper,
  isLetterPaper,
  isProofPaper,
  type CvTemplate,
  type LetterSituation,
} from "@/lib/paper/types";
import { wordForTemplate } from "@/lib/paper/cv";
import { useT } from "@/lib/i18n/use-t";
import { CvEditor } from "./cv-editor";
import { Library } from "./library";
import { PaperEditor } from "./paper-editor";
import { ProofEditor } from "./proof-editor";
import { CvGallery, LetterChooser } from "./choosers";

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
  const creating = searchParams.get("new");

  const editing = id ? (paper.find((item) => item.id === id) ?? null) : null;

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

  const createCv = (template: CvTemplate, fromProfile: boolean) => {
    const role = profile.identity.targetRole.trim();
    const word = wordForTemplate(template);
    pending.current = true;
    dispatch(
      "paper.create",
      {
        type: "cv",
        label: role ? `${word}, ${role}` : t(m.paper.cv.untitled(1)),
        template,
        fromProfile,
        ...(role ? { targetRole: role } : {}),
      },
      { silent: true },
    );
  };

  const createLetter = (
    situation: LetterSituation,
    extras: { role?: string; org?: string } = {},
  ) => {
    const role = extras.role?.trim();
    const org = extras.org?.trim();
    pending.current = true;
    dispatch("paper.create", {
      type: "letter",
      label: [role, org].filter(Boolean).join(" · ") || t(m.paper.letter.untitled),
      situation,
      ...(role ? { targetRole: role } : {}),
    });
  };

  const createProof = () => {
    pending.current = true;
    dispatch("paper.create", {
      type: "proof",
      label: t(m.paper.proof.untitled),
    });
  };

  if (creating === "cv" && !editing) {
    return (
      <CvGallery
        onPick={(template) => createCv(template, Boolean(profile.identity.name))}
        onBack={() => router.replace("/paper", { scroll: false })}
      />
    );
  }

  if (creating === "letter" && !editing) {
    return (
      <LetterChooser
        onPick={createLetter}
        onBack={() => router.replace("/paper", { scroll: false })}
      />
    );
  }

  if (editing && isCvPaper(editing)) {
    return (
      <CvEditor
        cv={editing}
        onBack={() => router.replace("/paper", { scroll: false })}
      />
    );
  }

  if (editing && isLetterPaper(editing)) {
    return (
      <PaperEditor
        paper={editing}
        opening={openingForPaper(state, editing.id)}
        onBack={() => router.replace("/paper", { scroll: false })}
      />
    );
  }

  if (editing && isProofPaper(editing)) {
    return (
      <ProofEditor
        paper={editing}
        onBack={() => router.replace("/paper", { scroll: false })}
      />
    );
  }

  return (
    <Library
      onOpen={(openId) => router.push(hrefFor(openId))}
      onCreateCv={() => router.replace("/paper?new=cv", { scroll: false })}
      onCreateLetter={() => router.replace("/paper?new=letter", { scroll: false })}
      onCreateProof={createProof}
    />
  );
}
