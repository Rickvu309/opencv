import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPaperPatch,
  completenessCopy,
  emptyCv,
  filterPaperListRows,
  paperBlockPatchSchema,
  paperIdFromScreen,
  profileLinesOnPage,
  relativeUpdated,
  sortPaperListRows,
} from "@/features/paper/model";
import type { Profile } from "@/features/profile/model";

const profile: Profile = {
  name: "Linh",
  targetRole: "analyst",
  location: "Da Nang",
  timeAvailable: "",
  summary: "",
  facts: [{ id: "s1", label: "Skill", value: "SQL" }],
  experience: [
    {
      id: "e1",
      org: "Cafe",
      role: "Barista",
      dateFrom: "",
      dateTo: "",
      detail: [],
    },
  ],
  education: { school: "DUT", major: "", year: "", gpa: "", courses: [] },
  links: [],
};

describe("paper copy helpers", () => {
  it("counts profile lines that are on the page", () => {
    const content = emptyCv();
    content.name = "Linh";
    content.experience = [
      { id: "e1", org: "Cafe", role: "Barista", dates: "", bullets: [""] },
    ];
    const { onPage, total } = profileLinesOnPage(profile, content);
    assert.equal(total, 4);
    assert.equal(onPage, 2);
  });

  it("writes completeness as a full sentence", () => {
    assert.equal(completenessCopy(0, 0), "");
    assert.equal(completenessCopy(1, 1), "1 of 1 profile line is on this page.");
    assert.equal(completenessCopy(1, 4), "1 of 4 profile lines is on this page.");
    assert.equal(completenessCopy(4, 4), "4 of 4 profile lines are on this page.");
  });

  it("merges one block without touching the others", () => {
    const content = emptyCv();
    content.name = "Linh";
    content.contact = "Da Nang";
    const next = applyPaperPatch(content, { name: "An" });
    assert.equal(next.name, "An");
    assert.equal(next.contact, "Da Nang");
  });

  it("rejects a patch that is not exactly one block", () => {
    assert.equal(paperBlockPatchSchema.safeParse({}).success, false);
    assert.equal(paperBlockPatchSchema.safeParse({ name: "An", contact: "Hue" }).success, false);
    assert.equal(paperBlockPatchSchema.safeParse({ name: "An" }).success, true);
  });

  it("reads a paper id from the opened-document screen", () => {
    assert.equal(paperIdFromScreen("/paper/abc"), "abc");
    assert.equal(paperIdFromScreen("/paper"), null);
    assert.equal(paperIdFromScreen("/coach"), null);
  });

  it("formats updated time in the user's terms", () => {
    const now = Date.parse("2026-08-18T10:00:00.000Z");
    assert.equal(relativeUpdated("2026-08-18T09:59:30.000Z", now), "just now");
    assert.equal(relativeUpdated("2026-08-18T09:00:00.000Z", now), "1 hour ago");
    assert.equal(relativeUpdated("2026-08-16T10:00:00.000Z", now), "2 days ago");
  });
});

describe("paper list rows", () => {
  const rows = [
    { kind: "paper" as const, paperKind: "cv", updated: "2026-08-18T10:00:00.000Z" },
    { kind: "file" as const, updated: "2026-08-19T10:00:00.000Z" },
    { kind: "paper" as const, paperKind: "letter", updated: "2026-08-17T10:00:00.000Z" },
  ];

  it("sorts newest first across papers and uploads", () => {
    const sorted = sortPaperListRows(rows);
    assert.equal(sorted[0]?.kind, "file");
    assert.equal(sorted[1]?.paperKind, "cv");
    assert.equal(sorted[2]?.paperKind, "letter");
  });

  it("keeps only uploads on the Uploaded filter", () => {
    const visible = filterPaperListRows(rows, "uploaded");
    assert.equal(visible.length, 1);
    assert.equal(visible[0]?.kind, "file");
  });

  it("keeps only letters on the Letter filter", () => {
    const visible = filterPaperListRows(rows, "letter");
    assert.equal(visible.length, 1);
    assert.equal(visible[0]?.paperKind, "letter");
  });
});
