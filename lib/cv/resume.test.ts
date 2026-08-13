// The CV is the first thing in this app the user will send to someone else, so
// the parts that decide what lands on the page are tested directly: what gets
// carried over from the profile, what the fourteen `resume.*` reducers do, and
// what comes out of an export.

import { test } from "node:test";
import assert from "node:assert/strict";

import { populated } from "@/lib/actions/fixture";
import { applyAction } from "@/lib/actions/registry";
import { seedState } from "@/lib/actions/seed";
import { nextId } from "@/lib/cv/build";
import { fileStem, toMarkdown, toPlainText } from "@/lib/cv/export";
import { bullets, resumeCompleteness } from "@/lib/cv/types";
import type { AppState } from "@/lib/actions/types";

/** A state holding one CV built from the fixture profile. */
function withResume(): { state: AppState; id: string } {
  const state = applyAction(populated(), "resume.create", {
    label: "CV, Data Analyst",
  }).state;
  return { state, id: state.resumes[0].id };
}

test("a CV built from the profile carries the work already typed in", () => {
  const { state } = withResume();
  const resume = state.resumes[0];

  assert.equal(resume.header.name, "Lê Thu Hà");
  assert.equal(resume.targetRole, "Data Analyst");
  // Retyping the profile into a CV is the work this feature exists to remove.
  assert.equal(
    resume.header.location,
    "Hà Nội",
    "location comes from the profile's context rows",
  );

  const experience = resume.sections.find((s) => s.kind === "experience");
  assert.equal(experience?.entries.length, 1);
  assert.equal(experience?.entries[0].title, "Thực tập sinh phân tích");
  assert.equal(experience?.entries[0].org, "Công ty ABC");

  const education = resume.sections.find((s) => s.kind === "education");
  assert.equal(education?.entries[0].org, "Đại học Bách khoa");
  assert.match(education?.entries[0].detail ?? "", /3\.2\/4\.0/);

  const certs = resume.sections.find((s) => s.kind === "certifications");
  assert.equal(certs?.entries[0].title, "Google Data Analytics");
});

test("a blank CV invents nothing", () => {
  const state = applyAction(seedState(), "resume.create", {
    label: "CV trống",
    fromProfile: false,
  }).state;
  const resume = state.resumes[0];

  assert.equal(resume.header.name, "");
  assert.deepEqual(
    resume.sections.flatMap((s) => s.entries),
    [],
  );
  // Named-but-empty: an editor that opens on nothing asks the user to invent
  // the structure of a CV, which is the part they came here not to know.
  assert.deepEqual(
    resume.sections.map((s) => s.kind),
    ["summary", "experience", "education", "skills"],
  );
});

test("editing one CV leaves the other alone", () => {
  const first = withResume();
  const two = applyAction(first.state, "resume.duplicate", {
    id: first.id,
    label: "CV, Business Analyst",
  }).state;

  const copy = two.resumes[1];
  const section = copy.sections.find((s) => s.kind === "experience")!;

  const after = applyAction(two, "resume.updateEntry", {
    id: copy.id,
    sectionId: section.id,
    entryId: section.entries[0].id,
    title: "Chuyên viên phân tích nghiệp vụ",
  }).state;

  assert.equal(
    after.resumes[1].sections.find((s) => s.kind === "experience")?.entries[0]
      .title,
    "Chuyên viên phân tích nghiệp vụ",
  );
  // The whole point of rewriting ids on duplicate: a shared id would make one
  // edit land on both CVs.
  assert.equal(
    after.resumes[0].sections.find((s) => s.kind === "experience")?.entries[0]
      .title,
    "Thực tập sinh phân tích",
  );
});

test("moving a section is clamped rather than wrapping", () => {
  const { state, id } = withResume();
  const first = state.resumes[0].sections[0];

  const up = applyAction(state, "resume.moveSection", {
    id,
    sectionId: first.id,
    by: -1,
  }).state;
  assert.equal(
    up.resumes[0].sections[0].id,
    first.id,
    "the top section must not wrap to the bottom",
  );

  const down = applyAction(state, "resume.moveSection", {
    id,
    sectionId: first.id,
    by: 1,
  }).state;
  assert.equal(down.resumes[0].sections[1].id, first.id);
});

test("hiding a section keeps it but takes it off the page", () => {
  const { state, id } = withResume();
  const experience = state.resumes[0].sections.find(
    (s) => s.kind === "experience",
  )!;

  const after = applyAction(state, "resume.updateSection", {
    id,
    sectionId: experience.id,
    hidden: true,
  }).state;

  const section = after.resumes[0].sections.find((s) => s.id === experience.id);
  assert.equal(section?.hidden, true);
  assert.equal(section?.entries.length, 1, "hiding must not delete the content");
  assert.ok(
    !toMarkdown(after.resumes[0]).includes("Thực tập sinh phân tích"),
    "a hidden section must not reach an export",
  );
});

test("every resume edit restamps the CV, so the card cannot lie", () => {
  const { state, id } = withResume();
  const stale = { ...state, resumes: [{ ...state.resumes[0], updatedAt: "3 tuần trước" }] };

  const after = applyAction(stale, "resume.rename", { id, label: "CV mới" }).state;
  assert.equal(after.resumes[0].updatedAt, "Vừa xong");
});

test("an edit aimed at a CV that is gone changes nothing", () => {
  const { state } = withResume();
  const after = applyAction(state, "resume.rename", {
    id: "cv-does-not-exist",
    label: "Không có thật",
  }).state;
  assert.deepEqual(after.resumes, state.resumes);
});

test("nextId reads the highest suffix, not the length", () => {
  // Counting would reuse an id after a removal, and every edit action targets
  // an id: reuse means an edit aimed at a deleted entry lands on its successor.
  assert.equal(nextId("cv", ["cv-1", "cv-2"]), "cv-3");
  assert.equal(nextId("cv", ["cv-1", "cv-3"]), "cv-4");
  assert.equal(nextId("cv", []), "cv-1");
  assert.equal(nextId("cv", ["cv-other", "unrelated-9"]), "cv-1");
});

test("removing an entry does not free its id for the next one", () => {
  const { state, id } = withResume();
  const section = state.resumes[0].sections.find((s) => s.kind === "experience")!;

  const added = applyAction(state, "resume.addEntry", {
    id,
    sectionId: section.id,
    title: "Việc thứ hai",
  }).state;
  const second = added.resumes[0].sections.find((s) => s.id === section.id)!
    .entries[1];

  const removed = applyAction(added, "resume.removeEntry", {
    id,
    sectionId: section.id,
    entryId: section.entries[0].id,
  }).state;
  const readded = applyAction(removed, "resume.addEntry", {
    id,
    sectionId: section.id,
    title: "Việc thứ ba",
  }).state;

  const ids = readded.resumes[0].sections
    .find((s) => s.id === section.id)!
    .entries.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "ids must stay unique");
  assert.ok(ids.includes(second.id));
});

test("bullets are one per line, with any leading marker stripped", () => {
  assert.deepEqual(bullets("- Một\n* Hai\n• Ba"), ["Một", "Hai", "Ba"]);
  assert.deepEqual(bullets("Một\n\n  \nHai"), ["Một", "Hai"]);
  assert.deepEqual(bullets(undefined), []);
});

test("exports skip entries with nothing in them", () => {
  const { state, id } = withResume();
  const section = state.resumes[0].sections.find((s) => s.kind === "experience")!;

  // The editor adds a blank entry and lets the user type into it, so a
  // half-finished row is a normal state rather than a broken one.
  const after = applyAction(state, "resume.addEntry", {
    id,
    sectionId: section.id,
  }).state;

  const markdown = toMarkdown(after.resumes[0]);
  assert.ok(markdown.includes("Thực tập sinh phân tích"));
  assert.ok(!markdown.includes("### \n"), "a blank entry must not print a heading");
});

test("markdown carries the bullets a reader is scanning for", () => {
  const { state, id } = withResume();
  const section = state.resumes[0].sections.find((s) => s.kind === "experience")!;

  const after = applyAction(state, "resume.updateEntry", {
    id,
    sectionId: section.id,
    entryId: section.entries[0].id,
    detail: "Giảm thời gian báo cáo tuần từ 4h xuống 30 phút\nDựng 3 dashboard",
  }).state;

  const markdown = toMarkdown(after.resumes[0]);
  assert.ok(markdown.includes("- Giảm thời gian báo cáo tuần từ 4h xuống 30 phút"));
  assert.ok(markdown.includes("- Dựng 3 dashboard"));

  const text = toPlainText(after.resumes[0]);
  assert.ok(text.includes("KINH NGHIỆM"), "plain text separates by case");
  assert.ok(!text.includes("###"), "plain text must carry no markup");
});

test("a filename survives Vietnamese and a filesystem", () => {
  const { state } = withResume();
  assert.equal(fileStem(state.resumes[0]), "Le_Thu_Ha_CV_Data_Analyst");

  const nameless = { ...state.resumes[0], header: { ...state.resumes[0].header, name: "" }, label: "" };
  assert.equal(fileStem(nameless), "CV", "never produce an empty filename");
});

test("completeness rewards a filled CV and ignores an empty one", () => {
  const blank = applyAction(seedState(), "resume.create", {
    label: "CV trống",
    fromProfile: false,
  }).state.resumes[0];
  assert.equal(resumeCompleteness(blank), 0);

  const { state } = withResume();
  const built = resumeCompleteness(state.resumes[0]);
  assert.ok(built > 0 && built < 100, `expected partial, got ${built}`);
});
