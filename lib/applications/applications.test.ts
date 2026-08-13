// The transitions are a product rule, and a product rule with no test is a
// comment. These pin down what the tracker will and will not let somebody do
// to a row that represents a real job they are chasing.

import { test } from "node:test";
import assert from "node:assert/strict";

import { applyAction } from "@/lib/actions/registry";
import { seedState } from "@/lib/actions/seed";
import {
  FORWARD_STATUSES,
  byUrgency,
  canTransition,
  nextStep,
  type Application,
} from "@/lib/applications/types";
import { locales } from "@/lib/i18n/locale";
import { SEED_OPENINGS } from "@/lib/search/types";

const opening = SEED_OPENINGS[0].id;

/** A state with one saved opening and one application to it. */
function tracking() {
  const saved = applyAction(seedState(), "opening.save", { id: opening }).state;
  return applyAction(saved, "application.create", { openingId: opening }).state;
}

test("AC-APP-002.1: forward moves one stage at a time", () => {
  for (let i = 0; i < FORWARD_STATUSES.length - 1; i += 1) {
    assert.equal(
      canTransition(FORWARD_STATUSES[i], FORWARD_STATUSES[i + 1]),
      true,
    );
  }
  // And not two at a time: somebody who has not applied cannot be interviewing.
  assert.equal(canTransition("interested", "interviewing"), false);
  assert.equal(canTransition("interested", "offer"), false);
});

test("AC-APP-002.2: backward is allowed to any earlier stage", () => {
  // Freely, because the reason is always a correction, and a tracker that will
  // not let you fix a misclick is a tracker people stop updating.
  assert.equal(canTransition("offer", "applied"), true);
  assert.equal(canTransition("interviewing", "interested"), true);
  assert.equal(canTransition("offer", "interested"), true);
});

test("AC-APP-002.3: rejected can arrive from anywhere", () => {
  for (const status of FORWARD_STATUSES) {
    assert.equal(canTransition(status, "rejected"), true);
  }
});

test("a company that writes again a month later is not a second row", () => {
  // Coming back from rejected is allowed on purpose. The alternative is the
  // user making a duplicate application for the same job.
  assert.equal(canTransition("rejected", "interviewing"), true);
});

test("a status cannot transition to itself", () => {
  assert.equal(canTransition("applied", "applied"), false);
});

test("AC-APP-001.2: an application starts as interested", () => {
  const state = tracking();
  assert.equal(state.applications.length, 1);
  assert.equal(state.applications[0].status, "interested");
});

test("creating an application saves the opening it is to", () => {
  // You cannot be applying to something you have not kept.
  const state = applyAction(seedState(), "application.create", {
    openingId: opening,
  }).state;
  assert.equal(state.openings.find((entry) => entry.id === opening)?.saved, true);
});

test("one opening gets one application, not two", () => {
  // Two rows for one job is a tracker that disagrees with itself about where
  // that job stands.
  let state = tracking();
  state = applyAction(state, "application.create", { openingId: opening }).state;
  assert.equal(state.applications.length, 1);
});

test("an application to an opening that does not exist is not created", () => {
  const state = applyAction(seedState(), "application.create", {
    openingId: "nothing-like-this",
  }).state;
  assert.equal(state.applications.length, 0);
});

test("AC-APP-001.3: a legal status change is saved", () => {
  const state = applyAction(tracking(), "application.setStatus", {
    id: "app-1",
    status: "applied",
  }).state;
  assert.equal(state.applications[0].status, "applied");
});

test("an illegal status change leaves the row alone", () => {
  // Ignored rather than thrown: a rejected dispatch would surface to the user
  // as "that change didn't go through" for a change that was never meaningful.
  const before = tracking();
  const after = applyAction(before, "application.setStatus", {
    id: before.applications[0].id,
    status: "offer",
  }).state;
  assert.equal(after.applications[0].status, "interested");
});

test("AC-APP-005: notes are saved and kept", () => {
  const before = tracking();
  const after = applyAction(before, "application.setNotes", {
    id: before.applications[0].id,
    notes: "Nói chuyện với chị Lan, hỏi về dự án cuối",
  }).state;
  assert.match(after.applications[0].notes, /chị Lan/);
});

test("AC-APP-006: a deadline is set, and can be cleared", () => {
  const before = tracking();
  const set = applyAction(before, "application.setDeadline", {
    id: before.applications[0].id,
    deadline: "2026-09-01",
  }).state;
  assert.equal(set.applications[0].deadline, "2026-09-01");

  const cleared = applyAction(set, "application.setDeadline", {
    id: before.applications[0].id,
    deadline: "",
  }).state;
  assert.equal(cleared.applications[0].deadline, undefined);
});

test("a deadline that is not a date is refused", () => {
  const before = tracking();
  assert.throws(() =>
    applyAction(before, "application.setDeadline", {
      id: before.applications[0].id,
      deadline: "next tuesday",
    }),
  );
});

test("AC-APP-007.1: every status has a next step, in both languages", () => {
  for (const status of [...FORWARD_STATUSES, "rejected" as const]) {
    for (const locale of locales) {
      assert.ok(
        nextStep(status)[locale].trim().length > 10,
        `${status} has no ${locale} next step`,
      );
    }
  }
});

test("the next step differs by stage", () => {
  // A tracker that says the same thing at every stage is a decoration.
  const steps = new Set(FORWARD_STATUSES.map((status) => nextStep(status).vi));
  assert.equal(steps.size, FORWARD_STATUSES.length);
});

test("AC-APP-003: tailoring copies the CV and binds the copy, not the original", () => {
  let state = tracking();
  state = applyAction(state, "resume.create", { label: "CV chính" }).state;
  const original = state.resumes[0];

  state = applyAction(state, "application.tailorResume", {
    id: state.applications[0].id,
    resumeId: original.id,
    label: "CV · Data Analyst Intern",
  }).state;

  assert.equal(state.resumes.length, 2, "the original is still there");
  const copy = state.resumes.find((resume) => resume.id !== original.id)!;
  assert.notEqual(copy.id, original.id, "the copy has its own id");
  assert.deepEqual(state.applications[0].tailoredDocumentIds, [copy.id]);

  // AC-APP-003.2: editing the copy must not reach the original.
  const edited = applyAction(state, "resume.rename", {
    id: copy.id,
    label: "CV · sửa riêng",
  }).state;
  assert.equal(
    edited.resumes.find((resume) => resume.id === original.id)?.label,
    "CV chính",
  );
});

test("tailoring a letter binds a new cover letter to the application", () => {
  let state = tracking();
  state = applyAction(state, "application.tailorLetter", {
    id: state.applications[0].id,
    label: "Thư · Data Analyst Intern",
    targetRole: "Data Analyst Intern",
  }).state;

  assert.equal(state.papers.length, 1);
  assert.equal(state.papers[0].kind, "cover-letter");
  assert.deepEqual(state.applications[0].tailoredDocumentIds, [state.papers[0].id]);
});

test("tailoring for an application that does not exist changes nothing", () => {
  const state = seedState();
  const after = applyAction(state, "application.tailorLetter", {
    id: "app-nothing",
    label: "Thư",
  }).state;
  assert.equal(after.papers.length, 0);
});

test("removing an application does not remove its tailored documents", () => {
  // The copy is the user's work. Deleting the tracking row is a decision about
  // the row, not about the CV they spent an evening on.
  let state = tracking();
  state = applyAction(state, "application.tailorLetter", {
    id: state.applications[0].id,
    label: "Thư",
  }).state;
  state = applyAction(state, "application.remove", {
    id: state.applications[0].id,
  }).state;

  assert.equal(state.applications.length, 0);
  assert.equal(state.papers.length, 1);
});

test("the soonest deadline comes first, and closed rows sink", () => {
  const now = Date.now();
  const app = (over: Partial<Application>): Application => ({
    id: "x",
    openingId: "o",
    status: "applied",
    tailoredDocumentIds: [],
    notes: "",
    createdAt: now,
    updatedAt: now,
    ...over,
  });

  const ordered = byUrgency([
    app({ id: "no-deadline" }),
    app({ id: "later", deadline: "2026-12-01" }),
    app({ id: "rejected-soon", deadline: "2026-08-01", status: "rejected" }),
    app({ id: "soon", deadline: "2026-09-01" }),
  ]);

  assert.deepEqual(
    ordered.map((entry) => entry.id),
    ["soon", "later", "no-deadline", "rejected-soon"],
  );
});
