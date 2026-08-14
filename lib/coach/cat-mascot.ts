/**
 * Multi-stage cat mascot catalog.
 *
 * One vessel, ten product moments, ten frames each. Screens pick a `useCase`
 * and a `stage` (0–9); they do not redraw the cat. The Coach empty greeting
 * is idle / stage 0 / playing off, which is the original sleeping mark.
 */

export const CAT_USE_CASES = [
  "idle",
  "listen",
  "think",
  "speak",
  "write",
  "read",
  "search",
  "nudge",
  "success",
  "error",
] as const;

export type CatUseCase = (typeof CAT_USE_CASES)[number];

export const CAT_STAGE_COUNT = 10;

/** Interval for optional `playing` loops. Matches `--duration-reveal`. */
export const CAT_MASCOT_PLAY_MS = 500;

export const CAT_MASCOT_DEFAULT_USE_CASE = "idle" satisfies CatUseCase;
export const CAT_MASCOT_DEFAULT_STAGE = 0;
export const CAT_MASCOT_DEFAULT_PLAYING = false;

export const CAT_MOUTHS = ["none", "line", "open"] as const;
export type CatMouth = (typeof CAT_MOUTHS)[number];

export const CAT_EXTRAS = [
  "none",
  "zzz",
  "dots",
  "page",
  "write",
  "lens",
  "mark",
  "check",
  "dash",
] as const;
export type CatExtra = (typeof CAT_EXTRAS)[number];

/**
 * Shared line-art of the sleeping cat. Stages compose on top of this;
 * they do not replace the species.
 */
export const CAT_BODY = {
  viewBox: "0 0 44 30",
  earLeft: "M10.5 12.4 L12.6 3.6 L19.6 9.3",
  earRight: "M33.5 12.4 L31.4 3.6 L24.4 9.3",
  crown: "M19.6 9.3 Q22 8.5 24.4 9.3",
  head: "M10.5 12.4 C9.1 17.2 9.7 22 13.6 24.8 C18.1 27.4 25.9 27.4 30.4 24.8 C34.3 22 34.9 17.2 33.5 12.4",
  whiskerLeft: "M5 17.6 L10 18.7 M5 21.6 L10 20.5",
  whiskerRight: "M39 17.6 L34 18.7 M39 21.6 L34 20.5",
  eyeLeft: { x: 15.9, y: 15.1, width: 3.4, height: 3.4, rx: 1.7 },
  eyeRight: { x: 24.7, y: 15.1, width: 3.4, height: 3.4, rx: 1.7 },
  nose: "M20.9 19.9 L23.1 19.9 L22 21.3 Z",
  mouthLine: "M20.2 22.35 H23.8",
  mouthOpen: "M20.4 22.1 Q22 23.55 23.6 22.1",
} as const;

export type CatPose = {
  /** 1 = current dots; lower squashes toward a sleepy slit. */
  eyeScaleY: number;
  lookX: number;
  lookY: number;
  earLeft: number;
  earRight: number;
  /** Whisker droop in SVG units; negative lifts them. */
  whisker: number;
  mouth: CatMouth;
  extra: CatExtra;
  extraOpacity: number;
  extraX: number;
  extraY: number;
  headTilt: number;
  headY: number;
};

export const CAT_POSE_REST: CatPose = {
  eyeScaleY: 1,
  lookX: 0,
  lookY: 0,
  earLeft: 0,
  earRight: 0,
  whisker: 0,
  mouth: "none",
  extra: "none",
  extraOpacity: 0,
  extraX: 0,
  extraY: 0,
  headTilt: 0,
  headY: 0,
};

export type CatStages = readonly [
  CatPose,
  CatPose,
  CatPose,
  CatPose,
  CatPose,
  CatPose,
  CatPose,
  CatPose,
  CatPose,
  CatPose,
];

export type CatUseCaseEntry = {
  id: CatUseCase;
  /** Implementer note: when to pick this use case. Not UI copy. */
  when: string;
  stages: CatStages;
};

function p(overrides: Partial<CatPose>): CatPose {
  return { ...CAT_POSE_REST, ...overrides };
}

function frames(list: readonly CatPose[]): CatStages {
  if (list.length !== CAT_STAGE_COUNT) {
    throw new Error(
      `Cat mascot sequence must have ${CAT_STAGE_COUNT} stages, got ${list.length}`,
    );
  }
  return list as unknown as CatStages;
}

const idle: CatUseCaseEntry = {
  id: "idle",
  when: "Coach waiting on an empty thread. Stage 0 is the sleeping greeting.",
  stages: frames([
    p({ extra: "zzz", extraOpacity: 1 }),
    p({ extra: "zzz", extraOpacity: 1, eyeScaleY: 0.72, lookY: 0.35 }),
    p({
      extra: "zzz",
      extraOpacity: 1,
      eyeScaleY: 0.55,
      lookY: 0.45,
      headY: 0.7,
    }),
    p({ extra: "zzz", extraOpacity: 0.85, eyeScaleY: 0.7, headY: 0.15 }),
    p({ extra: "zzz", extraOpacity: 1, eyeScaleY: 0.6, headY: 0.65 }),
    p({
      extra: "zzz",
      extraOpacity: 1,
      eyeScaleY: 0.7,
      earLeft: 10,
      headY: 0.4,
    }),
    p({
      extra: "zzz",
      extraOpacity: 0.9,
      eyeScaleY: 0.75,
      earRight: -8,
      headY: 0.35,
    }),
    p({
      extra: "zzz",
      extraOpacity: 0.8,
      eyeScaleY: 0.65,
      whisker: 0.55,
      headY: 0.5,
    }),
    p({
      extra: "zzz",
      extraOpacity: 0.45,
      eyeScaleY: 0.92,
      lookY: 0.1,
      headY: 0.15,
    }),
    p({
      extra: "zzz",
      extraOpacity: 1,
      eyeScaleY: 0.88,
      lookY: 0.2,
      headY: 0.25,
    }),
  ]),
};

const listen: CatUseCaseEntry = {
  id: "listen",
  when: "User is typing or the Coach is attending. Ears up, no z's.",
  stages: frames([
    p({}),
    p({ earLeft: -6, earRight: 6 }),
    p({ earLeft: -12, earRight: 12 }),
    p({ earLeft: -12, earRight: 12, lookY: -0.35 }),
    p({ earLeft: -12, earRight: 12, lookY: -0.35, headY: -0.7 }),
    p({ earLeft: -12, earRight: 12, lookY: -0.2, headY: -0.7, whisker: -0.25 }),
    p({ earLeft: -6, earRight: 12, lookY: -0.2, headY: -0.55 }),
    p({ earLeft: -12, earRight: 12, lookX: -1.15, headY: -0.55 }),
    p({ earLeft: -12, earRight: 12, lookX: 1.15, headY: -0.55 }),
    p({ earLeft: -12, earRight: 12, headY: -0.6, whisker: -0.2 }),
  ]),
};

const think: CatUseCaseEntry = {
  id: "think",
  when: "Generating a reply. Quiet look-up and dots, not a spinner.",
  stages: frames([
    p({ earLeft: 4, earRight: -4 }),
    p({ earLeft: 4, earRight: -4, lookY: -0.8 }),
    p({
      earLeft: 5,
      earRight: -5,
      lookY: -1.15,
      extra: "dots",
      extraOpacity: 0.25,
    }),
    p({
      earLeft: 5,
      earRight: -5,
      lookY: -1.15,
      extra: "dots",
      extraOpacity: 0.55,
    }),
    p({
      earLeft: 6,
      earRight: -4,
      lookY: -1,
      lookX: -0.45,
      extra: "dots",
      extraOpacity: 1,
    }),
    p({
      earLeft: 6,
      earRight: -6,
      lookY: -1,
      headTilt: -5,
      extra: "dots",
      extraOpacity: 1,
    }),
    p({
      earLeft: 4,
      earRight: -6,
      lookY: -0.9,
      lookX: 0.5,
      extra: "dots",
      extraOpacity: 0.85,
    }),
    p({
      earLeft: 8,
      earRight: -8,
      lookY: -0.7,
      eyeScaleY: 0.8,
      extra: "dots",
      extraOpacity: 0.9,
    }),
    p({
      earLeft: 6,
      earRight: -4,
      lookY: -0.85,
      headTilt: 4,
      extra: "dots",
      extraOpacity: 1,
    }),
    p({
      earLeft: 3,
      earRight: -3,
      lookY: -0.4,
      extra: "dots",
      extraOpacity: 0.4,
    }),
  ]),
};

const speak: CatUseCaseEntry = {
  id: "speak",
  when: "A reply is ready, or the Coach is talking through a step.",
  stages: frames([
    p({}),
    p({ mouth: "line" }),
    p({ mouth: "open", whisker: -0.2 }),
    p({ mouth: "open", whisker: -0.25, earLeft: -4, earRight: 4 }),
    p({ mouth: "line", earLeft: -4, earRight: 4 }),
    p({ mouth: "open", earLeft: -4, earRight: 4, whisker: -0.3 }),
    p({ mouth: "open", headY: 0.5, headTilt: 3 }),
    p({ mouth: "line", headY: 0 }),
    p({ mouth: "line", whisker: -0.35, earLeft: -6, earRight: 6 }),
    p({ mouth: "line", earLeft: -4, earRight: 4 }),
  ]),
};

const write: CatUseCaseEntry = {
  id: "write",
  when: "Drafting a CV, letter, or pitch.",
  stages: frames([
    p({ lookY: 0.8 }),
    p({ lookY: 1.15, eyeScaleY: 0.92 }),
    p({ lookY: 1.15, extra: "write", extraOpacity: 0.4 }),
    p({ lookY: 1.2, extra: "write", extraOpacity: 1 }),
    p({ lookY: 1.2, extra: "write", extraOpacity: 1, extraY: 0.45 }),
    p({ lookY: 1.2, extra: "write", extraOpacity: 1, extraY: -0.3 }),
    p({ lookY: 0.55, lookX: 0.85, extra: "write", extraOpacity: 1 }),
    p({ lookY: 1.2, extra: "write", extraOpacity: 1, extraY: 0.5 }),
    p({
      lookY: 1,
      extra: "write",
      extraOpacity: 1,
      eyeScaleY: 0.85,
      extraY: 0,
    }),
    p({ lookY: 1.15, extra: "write", extraOpacity: 1, headTilt: 3 }),
  ]),
};

const read: CatUseCaseEntry = {
  id: "read",
  when: "Reviewing a document the user already has.",
  stages: frames([
    p({ lookY: 0.7 }),
    p({ lookY: 1, extra: "page", extraOpacity: 0.45 }),
    p({ lookY: 1.15, extra: "page", extraOpacity: 1 }),
    p({ lookY: 1.15, lookX: -1.1, extra: "page", extraOpacity: 1 }),
    p({ lookY: 1.15, lookX: 1.1, extra: "page", extraOpacity: 1 }),
    p({ lookY: 1.15, lookX: -0.85, extra: "page", extraOpacity: 1 }),
    p({ lookY: 1, headTilt: 4, extra: "page", extraOpacity: 1 }),
    p({ lookY: 1.1, extra: "page", extraOpacity: 1, extraY: -0.4 }),
    p({ lookY: 1.15, lookX: 0.65, extra: "page", extraOpacity: 1 }),
    p({ lookY: 1.1, extra: "page", extraOpacity: 1, headTilt: 2 }),
  ]),
};

const search: CatUseCaseEntry = {
  id: "search",
  when: "Looking through openings or scanning a list.",
  stages: frames([
    p({ lookX: -1.1 }),
    p({ lookX: 1.1 }),
    p({ lookX: 0.4, extra: "lens", extraOpacity: 0.5 }),
    p({ lookX: -1.05, extra: "lens", extraOpacity: 1 }),
    p({ lookX: 1.05, extra: "lens", extraOpacity: 1, headY: -0.35 }),
    p({ lookX: 0.7, extra: "lens", extraOpacity: 1, extraX: 0.8 }),
    p({ lookX: 0, extra: "lens", extraOpacity: 1, eyeScaleY: 0.9 }),
    p({ lookX: -1, extra: "lens", extraOpacity: 1, extraX: -0.55 }),
    p({ extra: "lens", extraOpacity: 1, headY: -0.35, earLeft: -6, earRight: 6 }),
    p({ extra: "lens", extraOpacity: 0.9, earLeft: -4, earRight: 4 }),
  ]),
};

const nudge: CatUseCaseEntry = {
  id: "nudge",
  when: "Empty profile or a field that still needs filling in.",
  stages: frames([
    p({}),
    p({ earLeft: -8, earRight: 8 }),
    p({ earLeft: -10, earRight: 10, headY: -0.55 }),
    p({ earLeft: -10, earRight: 6, headTilt: -8, headY: -0.4 }),
    p({
      earLeft: -10,
      earRight: 6,
      headTilt: -8,
      extra: "mark",
      extraOpacity: 0.7,
    }),
    p({
      earLeft: -10,
      earRight: 8,
      headTilt: -8,
      extra: "mark",
      extraOpacity: 1,
    }),
    p({
      earLeft: -4,
      earRight: 10,
      headTilt: -6,
      extra: "mark",
      extraOpacity: 1,
    }),
    p({
      earLeft: -8,
      earRight: 8,
      headTilt: 6,
      extra: "mark",
      extraOpacity: 1,
    }),
    p({
      earLeft: -8,
      earRight: 8,
      headTilt: -5,
      extra: "mark",
      extraOpacity: 1,
      extraY: -0.5,
    }),
    p({
      earLeft: -8,
      earRight: 8,
      headTilt: -5,
      extra: "mark",
      extraOpacity: 0.85,
      headY: -0.3,
    }),
  ]),
};

const success: CatUseCaseEntry = {
  id: "success",
  when: "Something landed: a save, an apply, a finished draft. Restrained.",
  stages: frames([
    p({}),
    p({ earLeft: -8, earRight: 8 }),
    p({ earLeft: -10, earRight: 10, extra: "check", extraOpacity: 0.4 }),
    p({ earLeft: -10, earRight: 10, extra: "check", extraOpacity: 1 }),
    p({
      earLeft: -10,
      earRight: 10,
      extra: "check",
      extraOpacity: 1,
      headY: -0.5,
    }),
    p({
      earLeft: -8,
      earRight: 8,
      extra: "check",
      extraOpacity: 1,
      headY: 0.3,
    }),
    p({
      earLeft: -10,
      earRight: 10,
      extra: "check",
      extraOpacity: 1,
      whisker: -0.4,
    }),
    p({ earLeft: -10, earRight: 10, extra: "check", extraOpacity: 1 }),
    p({ earLeft: -6, earRight: 6, extra: "check", extraOpacity: 0.95 }),
    p({ earLeft: -6, earRight: 6, extra: "check", extraOpacity: 0.85 }),
  ]),
};

const error: CatUseCaseEntry = {
  id: "error",
  when: "Coach offline or a failed turn. Calm, not cartoon panic.",
  stages: frames([
    p({ eyeScaleY: 0.78 }),
    p({ eyeScaleY: 0.75, earLeft: 6, earRight: -6 }),
    p({ eyeScaleY: 0.7, earLeft: 10, earRight: -10, lookY: 0.4 }),
    p({
      eyeScaleY: 0.7,
      earLeft: 10,
      earRight: -10,
      lookY: 0.45,
      headY: 0.6,
    }),
    p({
      eyeScaleY: 0.7,
      earLeft: 10,
      earRight: -10,
      headY: 0.6,
      extra: "dash",
      extraOpacity: 0.5,
    }),
    p({
      eyeScaleY: 0.68,
      earLeft: 10,
      earRight: -10,
      headY: 0.65,
      extra: "dash",
      extraOpacity: 1,
    }),
    p({
      eyeScaleY: 0.68,
      earLeft: 10,
      earRight: -10,
      headY: 0.65,
      whisker: 0.55,
      extra: "dash",
      extraOpacity: 1,
    }),
    p({
      eyeScaleY: 0.7,
      earLeft: 12,
      earRight: -6,
      headY: 0.55,
      extra: "dash",
      extraOpacity: 1,
    }),
    p({
      eyeScaleY: 0.75,
      earLeft: 10,
      earRight: -8,
      lookX: 0.9,
      headY: 0.5,
      extra: "dash",
      extraOpacity: 0.9,
    }),
    p({
      eyeScaleY: 0.72,
      earLeft: 8,
      earRight: -8,
      headY: 0.5,
      extra: "dash",
      extraOpacity: 0.8,
    }),
  ]),
};

export const CAT_MASCOT_CATALOG: Record<CatUseCase, CatUseCaseEntry> = {
  idle,
  listen,
  think,
  speak,
  write,
  read,
  search,
  nudge,
  success,
  error,
};

const USE_CASE_SET: ReadonlySet<string> = new Set(CAT_USE_CASES);

export function isCatUseCase(value: string): value is CatUseCase {
  return USE_CASE_SET.has(value);
}

export function clampCatStage(stage: number): number {
  if (!Number.isFinite(stage)) return 0;
  return Math.min(CAT_STAGE_COUNT - 1, Math.max(0, Math.trunc(stage)));
}

export function wrapCatStage(stage: number): number {
  if (!Number.isFinite(stage)) return 0;
  const n = CAT_STAGE_COUNT;
  return ((Math.trunc(stage) % n) + n) % n;
}

export function catMascotPose(useCase: CatUseCase, stage: number): CatPose {
  const entry = CAT_MASCOT_CATALOG[useCase];
  return entry.stages[clampCatStage(stage)] ?? CAT_POSE_REST;
}

export type CatMascotFrame = {
  useCase: CatUseCase;
  stage: number;
  pose: CatPose;
  /** Opt-in z-drift on the idle greeting. Off while playing. CSS kills it under reduced motion. */
  driftZ: boolean;
};

export function resolveCatMascotFrame(input: {
  useCase?: string;
  stage?: number;
  playing?: boolean;
  playHead?: number;
  reducedMotion?: boolean;
}): CatMascotFrame {
  const rawUseCase = input.useCase ?? CAT_MASCOT_DEFAULT_USE_CASE;
  const useCase = isCatUseCase(rawUseCase)
    ? rawUseCase
    : CAT_MASCOT_DEFAULT_USE_CASE;
  const playing = input.playing ?? CAT_MASCOT_DEFAULT_PLAYING;
  const reducedMotion = input.reducedMotion ?? false;
  const stage = reducedMotion
    ? 0
    : playing
      ? wrapCatStage(input.playHead ?? input.stage ?? CAT_MASCOT_DEFAULT_STAGE)
      : clampCatStage(input.stage ?? CAT_MASCOT_DEFAULT_STAGE);

  return {
    useCase,
    stage,
    pose: catMascotPose(useCase, stage),
    driftZ: useCase === "idle" && !playing,
  };
}
