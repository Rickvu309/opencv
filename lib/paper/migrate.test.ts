import { test } from "node:test";
import assert from "node:assert/strict";

import { seedState } from "@/lib/actions/seed";
import { migrateStateShape, papersFromLegacy, uploadsFromLegacy } from "@/lib/paper/migrate";
import { isCvPaper, isLetterPaper, isProofPaper } from "@/lib/paper/types";

const legacyCv = {
  id: "cv-1",
  label: "CV, Data Analyst",
  language: "en",
  updatedAt: "Just now",
  header: {
    name: "Lê Thu Hà",
    headline: "",
    email: "",
    phone: "",
    location: "Hà Nội",
    links: [],
  },
  sections: [],
  theme: { template: "classic", accent: "ink", density: "normal" },
};

const legacyLetter = {
  id: "paper-1",
  kind: "cover-letter",
  label: "Thư cho VNG",
  language: "vi",
  body: "Kính gửi anh chị,",
  updatedAt: "Just now",
  targetRole: "Data Analyst",
};

test("legacy resumes and papers become one paper array with types", () => {
  const paper = papersFromLegacy({
    resumes: [legacyCv],
    papers: [legacyLetter],
  });

  assert.equal(paper.length, 2);
  assert.equal(paper[0]?.id, "cv-1", "ids are kept so photos still match");
  assert.ok(isCvPaper(paper[0]!));
  assert.equal(paper[0]?.type, "cv");
  assert.ok(isLetterPaper(paper[1]!));
  assert.equal(paper[1]?.type, "letter");
});

test("a write-up kind becomes a Proof whose text is the first note", () => {
  const paper = papersFromLegacy({
    papers: [{ ...legacyLetter, id: "paper-2", kind: "project-write-up" }],
  });
  assert.equal(paper[0]?.type, "proof");
  assert.equal(paper[0] && "notes" in paper[0] ? paper[0].notes[0]?.text : "", "Kính gửi anh chị,");
});

test("an already-migrated blob is left as paper[], not doubled", () => {
  const once = papersFromLegacy({
    paper: [
      { ...legacyCv, type: "cv" },
      { ...legacyLetter, type: "letter", kind: undefined },
    ],
  });
  assert.equal(once.length, 2);
  assert.equal(once[0]?.type, "cv");
  assert.equal(once[1]?.type, "letter");
});

test("duplicate ids across the old keys are kept once", () => {
  const paper = papersFromLegacy({
    paper: [{ ...legacyCv, type: "cv" }],
    resumes: [legacyCv],
  });
  assert.equal(paper.length, 1);
});

test("a present paper key of the wrong type is not emptied", () => {
  const migrated = migrateStateShape({ locale: "en", paper: "nope" } as Record<string, unknown>);
  assert.equal(migrated.paper, "nope");
});

test("profile CV and cover-letter documents become uploads", () => {
  const uploads = uploadsFromLegacy({
    profile: {
      documents: [
        {
          id: "cv-file",
          kind: "cv",
          label: "Old CV",
          fileName: "ha.pdf",
          language: "en",
          isPrimary: true,
          updatedAt: "Yesterday",
        },
        {
          id: "li-1",
          kind: "linkedin",
          label: "LinkedIn",
          url: "https://linkedin.com/in/ha",
          language: "en",
          isPrimary: true,
          updatedAt: "Yesterday",
        },
      ],
    },
  });
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0]?.id, "cv-file");
  assert.equal(uploads[0]?.fileName, "ha.pdf");
});

test("migrateStateShape drops the old keys", () => {
  const raw = {
    ...seedState(),
    resumes: [legacyCv],
    papers: [legacyLetter],
  } as Record<string, unknown>;
  delete raw.paper;

  const migrated = migrateStateShape(raw);
  assert.equal("resumes" in migrated, false);
  assert.equal("papers" in migrated, false);
  assert.equal(migrated.paper.length, 2);
  assert.equal(migrated.paper[0]?.type, "cv");
  assert.equal(migrated.paper[1]?.type, "letter");
  assert.ok(Array.isArray(migrated.uploads));
});

test("a stored write-up paper becomes a Proof after migrateStateShape", () => {
  const raw = {
    ...seedState(),
    paper: [{ ...legacyLetter, id: "paper-2", type: "write-up" }],
  };
  const migrated = migrateStateShape(raw);
  assert.equal(migrated.paper[0]?.type, "proof");
  assert.ok(isProofPaper(migrated.paper[0]!));
});
