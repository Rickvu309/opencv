import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CAT_BODY,
  CAT_EXTRAS,
  CAT_MASCOT_CATALOG,
  CAT_MASCOT_DEFAULT_PLAYING,
  CAT_MASCOT_DEFAULT_STAGE,
  CAT_MASCOT_DEFAULT_USE_CASE,
  CAT_MOUTHS,
  CAT_POSE_REST,
  CAT_STAGE_COUNT,
  CAT_USE_CASES,
  catMascotPose,
  clampCatStage,
  isCatUseCase,
  resolveCatMascotFrame,
  wrapCatStage,
  type CatExtra,
  type CatMouth,
} from "@/lib/coach/cat-mascot";

test("the catalog has at least ten use cases and ten stages each", () => {
  assert.ok(CAT_USE_CASES.length >= 10);
  assert.equal(CAT_STAGE_COUNT, 10);
  assert.deepEqual([...CAT_USE_CASES].sort(), Object.keys(CAT_MASCOT_CATALOG).sort());

  for (const id of CAT_USE_CASES) {
    const entry = CAT_MASCOT_CATALOG[id];
    assert.equal(entry.id, id);
    assert.ok(entry.when.length > 0, `${id} needs a when-to-use note`);
    assert.ok(entry.stages.length >= 10, `${id} needs ≥10 stages`);
  }
});

test("idle stage 0 is the sleeping Coach greeting pose", () => {
  assert.equal(CAT_MASCOT_DEFAULT_USE_CASE, "idle");
  assert.equal(CAT_MASCOT_DEFAULT_STAGE, 0);
  assert.equal(CAT_MASCOT_DEFAULT_PLAYING, false);

  const pose = catMascotPose("idle", 0);
  assert.equal(pose.extra, "zzz");
  assert.equal(pose.extraOpacity, 1);
  assert.equal(pose.mouth, "none");
  assert.equal(pose.eyeScaleY, 1);
  assert.equal(pose.lookX, 0);
  assert.equal(pose.lookY, 0);
  assert.equal(pose.earLeft, 0);
  assert.equal(pose.earRight, 0);
  assert.equal(pose.whisker, 0);
  assert.equal(pose.headTilt, 0);
  assert.equal(pose.headY, 0);
  assert.equal(pose.extraX, 0);
  assert.equal(pose.extraY, 0);
});

test("every use case × stage resolves without throwing", () => {
  const extras = new Set<string>(CAT_EXTRAS);
  const mouths = new Set<string>(CAT_MOUTHS);

  for (const id of CAT_USE_CASES) {
    for (let stage = 0; stage < CAT_STAGE_COUNT; stage++) {
      const pose = catMascotPose(id, stage);
      assert.ok(pose.eyeScaleY > 0 && pose.eyeScaleY <= 1, `${id}/${stage} eyeScaleY`);
      assert.ok(mouths.has(pose.mouth), `${id}/${stage} mouth`);
      assert.ok(extras.has(pose.extra), `${id}/${stage} extra`);
      assert.ok(pose.extraOpacity >= 0 && pose.extraOpacity <= 1);
    }
  }
});

test("poses stay in a quiet range", () => {
  for (const id of CAT_USE_CASES) {
    for (let stage = 0; stage < CAT_STAGE_COUNT; stage++) {
      const pose = catMascotPose(id, stage);
      assert.ok(Math.abs(pose.headTilt) <= 12, `${id}/${stage} headTilt`);
      assert.ok(Math.abs(pose.headY) <= 1.6, `${id}/${stage} headY`);
      assert.ok(Math.abs(pose.earLeft) <= 16, `${id}/${stage} earLeft`);
      assert.ok(Math.abs(pose.earRight) <= 16, `${id}/${stage} earRight`);
      assert.ok(Math.abs(pose.lookX) <= 1.4, `${id}/${stage} lookX`);
      assert.ok(Math.abs(pose.lookY) <= 1.4, `${id}/${stage} lookY`);
    }
  }
});

test("the vessel geometry is the sleeping-cat family", () => {
  assert.equal(CAT_BODY.viewBox, "0 0 44 30");
  assert.equal(CAT_BODY.earLeft, "M10.5 12.4 L12.6 3.6 L19.6 9.3");
  assert.equal(CAT_BODY.earRight, "M33.5 12.4 L31.4 3.6 L24.4 9.3");
  assert.equal(CAT_BODY.crown, "M19.6 9.3 Q22 8.5 24.4 9.3");
  assert.equal(
    CAT_BODY.head,
    "M10.5 12.4 C9.1 17.2 9.7 22 13.6 24.8 C18.1 27.4 25.9 27.4 30.4 24.8 C34.3 22 34.9 17.2 33.5 12.4",
  );
  assert.equal(CAT_BODY.whiskerLeft, "M5 17.6 L10 18.7 M5 21.6 L10 20.5");
  assert.equal(CAT_BODY.whiskerRight, "M39 17.6 L34 18.7 M39 21.6 L34 20.5");
  assert.equal(CAT_BODY.nose, "M20.9 19.9 L23.1 19.9 L22 21.3 Z");
  assert.deepEqual(CAT_BODY.eyeLeft, {
    x: 15.9,
    y: 15.1,
    width: 3.4,
    height: 3.4,
    rx: 1.7,
  });
  assert.deepEqual(CAT_BODY.eyeRight, {
    x: 24.7,
    y: 15.1,
    width: 3.4,
    height: 3.4,
    rx: 1.7,
  });
});

test("idle is the only use case that sleeps with z's on stage 0", () => {
  for (const id of CAT_USE_CASES) {
    const extra = catMascotPose(id, 0).extra;
    if (id === "idle") assert.equal(extra, "zzz");
    else assert.notEqual(extra, "zzz");
  }
});

test("defaults resolve to the greeting: idle, stage 0, z-drift on", () => {
  const frame = resolveCatMascotFrame({});
  assert.equal(frame.useCase, "idle");
  assert.equal(frame.stage, 0);
  assert.equal(frame.driftZ, true);
  assert.equal(frame.pose.extra, "zzz");
  assert.deepEqual(frame.pose, catMascotPose("idle", 0));
});

test("reduced motion freezes stage 0 and does not loop", () => {
  const frame = resolveCatMascotFrame({
    useCase: "think",
    stage: 7,
    playing: true,
    playHead: 7,
    reducedMotion: true,
  });
  assert.equal(frame.useCase, "think");
  assert.equal(frame.stage, 0);
  assert.equal(frame.driftZ, false);
  assert.deepEqual(frame.pose, catMascotPose("think", 0));
});

test("idle z-drift is opt-in unless playing", () => {
  assert.equal(resolveCatMascotFrame({}).driftZ, true);
  assert.equal(resolveCatMascotFrame({ playing: true }).driftZ, false);
  assert.equal(resolveCatMascotFrame({ useCase: "listen" }).driftZ, false);
});

test("playing wraps the play head; a static stage clamps", () => {
  const playing = resolveCatMascotFrame({
    useCase: "listen",
    playing: true,
    playHead: 12,
  });
  assert.equal(playing.stage, 2);
  assert.equal(playing.driftZ, false);

  const staticFrame = resolveCatMascotFrame({
    useCase: "listen",
    stage: 12,
  });
  assert.equal(staticFrame.stage, 9);

  assert.equal(clampCatStage(-3), 0);
  assert.equal(clampCatStage(Number.NaN), 0);
  assert.equal(wrapCatStage(-1), 9);
  assert.equal(wrapCatStage(10), 0);
});

test("an unknown use case falls back to idle", () => {
  const frame = resolveCatMascotFrame({ useCase: "dragon" });
  assert.equal(frame.useCase, "idle");
  assert.equal(isCatUseCase("idle"), true);
  assert.equal(isCatUseCase("dragon"), false);
});

test("rest pose is a quiet awake cat with no extra", () => {
  assert.equal(CAT_POSE_REST.extra, "none");
  assert.equal(CAT_POSE_REST.mouth, "none");
  assert.equal(CAT_POSE_REST.eyeScaleY, 1);

  const mouths = new Set<CatMouth>(CAT_MOUTHS);
  const extras = new Set<CatExtra>(CAT_EXTRAS);
  assert.ok(mouths.has("none") && mouths.has("line") && mouths.has("open"));
  assert.ok(extras.has("zzz") && extras.has("check") && extras.has("dash"));
});
