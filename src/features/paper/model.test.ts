import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPaperPatch,
  completenessCopy,
  cvLineFromPublishedProof,
  emptyCv,
  excerptEditRule,
  keepPublishedProofWords,
  openedCvActions,
  openedCvPage,
  openedPaperEditRule,
  paperBlockPatchSchema,
  paperCanvas,
  paperIdFromScreen,
  profileLinesOnPage,
  relativeUpdated,
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

const SATURDAY_CLOSE =
  "Saturday close. We ran out of oat milk and I stayed until the last table left.";

describe("paper canvas", () => {
  it("empty Paper is a dashed A4", () => {
    assert.deepEqual(paperCanvas({ published: [] }), { kind: "dashed" });
  });

  it("puts a published Proof on the A4 in the same words as the public card", () => {
    const canvas = paperCanvas({
      published: [
        {
          date: "2026-08-20",
          words: SATURDAY_CLOSE,
          what: "Led closing at a high-volume cafe",
          came: "cut wait time by 40%",
        },
      ],
    });
    assert.equal(canvas.kind, "cv");
    if (canvas.kind !== "cv") return;
    assert.deepEqual(canvas.lines, [{ date: "2026-08-20", words: SATURDAY_CLOSE }]);
    assert.equal(
      cvLineFromPublishedProof({
        date: "2026-08-20",
        words: SATURDAY_CLOSE,
        came: "cut wait time by 40%",
      })?.words,
      SATURDAY_CLOSE,
    );
  });

  it("keeps unpublished and skipped dumps off the A4", () => {
    assert.deepEqual(paperCanvas({ published: [] }), { kind: "dashed" });
    assert.equal(cvLineFromPublishedProof({ date: "2026-08-20", words: "" }), null);
    assert.equal(cvLineFromPublishedProof({ date: "2026-08-20", words: "   " }), null);
  });
});

const GHOSTS = [
  "Your name",
  "Email · phone · city",
  "A result, with a number if you have one",
];

describe("opened CV page", () => {
  it("does not invent name, contact, or empty-section heads", () => {
    const content = emptyCv();
    assert.equal(content.name, "");
    assert.equal(content.contact, "");
    assert.deepEqual(content.experience, []);
    assert.deepEqual(content.education, []);
    assert.deepEqual(content.skills, []);
    const page = openedCvPage(content);
    assert.equal(page.name, null);
    assert.equal(page.contact, null);
    assert.equal(page.showExperienceHeading, false);
    assert.equal(page.showEducationHeading, false);
    assert.equal(page.showSkillsHeading, false);
    assert.deepEqual(page.experience, []);
    assert.deepEqual(page.education, []);
    assert.deepEqual(page.skills, []);
    const dump = JSON.stringify(page);
    for (const ghost of GHOSTS) {
      assert.equal(dump.includes(ghost), false, ghost);
    }
  });

  it("never paints Experience, Education, or Skills heads", () => {
    const content = emptyCv();
    content.experience = [
      { id: "e1", org: "", role: "Closer", dates: "", bullets: [SATURDAY_CLOSE] },
    ];
    const page = openedCvPage(content);
    assert.equal(page.showExperienceHeading, false);
    assert.equal(page.showEducationHeading, false);
    assert.equal(page.showSkillsHeading, false);
    assert.equal(page.experience[0]?.bullets[0], SATURDAY_CLOSE);
  });

  it("keeps leftover emptyCv rows and their remove/result actions off", () => {
    const leftover = emptyCv();
    leftover.experience = [{ id: "e1", org: "", role: "", dates: "", bullets: [""] }];
    leftover.education = [{ id: "ed1", school: "", line: "" }];
    leftover.skills = [""];
    const page = openedCvPage(leftover);
    assert.deepEqual(page.experience, []);
    assert.deepEqual(page.education, []);
    assert.deepEqual(page.skills, []);
    assert.equal(page.showExperienceHeading, false);
    assert.deepEqual(openedCvActions(leftover), ["Add a role"]);
    assert.equal(openedCvActions(leftover).includes("Add a school"), false);
    assert.equal(openedCvActions(leftover).includes("Add a skill"), false);
  });

  it("offers remove and add-a-result only after a typed row", () => {
    const content = emptyCv();
    content.experience = [
      { id: "e1", org: "Cafe", role: "Barista", dates: "", bullets: [SATURDAY_CLOSE] },
    ];
    const actions = openedCvActions(content);
    assert.equal(actions.includes("Add a role"), true);
    assert.equal(actions.includes("Add a result"), true);
    assert.equal(actions.includes("Remove this role"), true);
    assert.equal(actions.includes("Add a school"), false);
    assert.equal(actions.includes("Add a skill"), false);
    assert.equal(actions.includes("Remove this school"), false);
    assert.equal(actions.includes("Remove this skill"), false);
  });

  it("puts the Saturday-close line under the role they typed", () => {
    const published = [{ date: "2026-08-20", words: SATURDAY_CLOSE }];
    const empty = openedCvPage(emptyCv(), published);
    assert.equal(empty.proofUnderRoleId, null);
    assert.deepEqual(empty.proofLines, published);
    assert.deepEqual(openedCvActions(emptyCv()), ["Add a role"]);
    assert.equal(empty.proofLines[0]?.words, SATURDAY_CLOSE);

    const content = emptyCv();
    content.experience = [{ id: "r1", org: "", role: "Closer", dates: "", bullets: [] }];
    const page = openedCvPage(content, published);
    assert.equal(page.proofUnderRoleId, "r1");
    assert.deepEqual(page.proofLines, published);
    assert.equal(page.proofLines[0]?.words, SATURDAY_CLOSE);
    assert.equal(page.showExperienceHeading, false);
    const dump = JSON.stringify(page);
    assert.equal(dump.includes("Barista"), false);
    assert.equal(dump.includes("Highlands"), false);
    assert.equal(dump.includes("cut wait time by 40%"), false);
  });
});

describe("Ask Coach on an opened CV", () => {
  const published = [{ date: "2026-08-20", words: SATURDAY_CLOSE }];

  it("leaves the Saturday-close Proof line unchanged", () => {
    assert.equal(keepPublishedProofWords(SATURDAY_CLOSE, published), SATURDAY_CLOSE);
    assert.equal(
      keepPublishedProofWords(`  ${SATURDAY_CLOSE}  `, published),
      SATURDAY_CLOSE,
    );
    assert.equal(keepPublishedProofWords("cut wait time by 40%", published), null);
  });

  it("forbids ghostwriting a published Proof line", () => {
    const rule = openedPaperEditRule(published);
    assert.match(rule, /read-only/);
    assert.match(rule, /Do not rewrite/);
    assert.match(rule, new RegExp(SATURDAY_CLOSE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(rule.includes("cut wait time by 40%"), false);
    const excerpt = excerptEditRule({ text: SATURDAY_CLOSE }, published);
    assert.match(excerpt, /Leave those words as they are/);
    assert.equal(excerpt.includes("STAR"), true);
  });
});
