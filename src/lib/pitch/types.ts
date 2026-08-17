import type { DocumentLanguage, Msg } from "@/lib/i18n/locale";

/**
 * How the user describes themselves, in words they can reuse.
 *
 * Three kinds, and the split is not cosmetic:
 *
 * - **bio** and **intro** are one each. A person has one online bio and one
 *   answer to "tell me about yourself"; keeping a list of them would be a
 *   drafting history nobody asked to manage, and the screen would have to pick
 *   one to show anyway.
 * - **answer** is a bank. "Điểm yếu của bạn là gì", "vì sao chọn ngành này",
 *   "kể về một lần thất bại" are separate questions asked at separate
 *   interviews, and the whole value is having several ready.
 *
 * The reducer enforces that, not the screen, so the Coach cannot create a
 * second bio by asking for one.
 *
 * ## Words here, links in the profile
 *
 * A LinkedIn URL is a fact and lives in `profile.documents`. A LinkedIn bio is
 * crafted words and lives here. Storing them together would blur the line the
 * whole product rests on: the profile holds what is true, everything else is
 * generated from it.
 */

export type PitchKind = "bio" | "intro" | "answer";

export const pitchKinds: PitchKind[] = ["bio", "intro", "answer"];

/** The kinds a person has exactly one of. */
export const singletonPitchKinds: PitchKind[] = ["bio", "intro"];

export function isSingletonPitchKind(kind: PitchKind): boolean {
  return singletonPitchKinds.includes(kind);
}

export const pitchKindLabels: Record<PitchKind, Msg> = {
  bio: "Online bio",
  intro: "Self-introduction",
  answer: "Interview answer",
};

export type PitchItem = {
  id: string;
  kind: PitchKind;
  /**
   * The question being answered. Only answers have one, and an answer without
   * it is an answer nobody can find again.
   */
  prompt?: string;
  body: string;
  /**
   * The item's own language, not the app's. Someone reading the interface in
   * Vietnamese still interviews in English sometimes.
   */
  language: DocumentLanguage;
};

/** The one bio, or the one intro, if it has been written. */
export function singletonOf(
  items: readonly PitchItem[],
  kind: PitchKind,
): PitchItem | undefined {
  return items.find((item) => item.kind === kind);
}

/** Every saved answer, in the order they were added. */
export function answersOf(items: readonly PitchItem[]): PitchItem[] {
  return items.filter((item) => item.kind === "answer");
}
