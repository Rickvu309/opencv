/**
 * Does the reply's claim about the user actually come from anywhere?
 *
 * ## The harm this is against
 *
 * A cover letter that says "I reduced processing time by 40%" when nobody ever
 * measured it. The user does not notice, because it sounds like something they
 * might have done, and they find out in the interview when somebody asks how it
 * was measured. Everything the Coach writes is written to be taken into a room
 * and defended, which makes an invented number worse than a missing one.
 *
 * ## What is checked, and what is not
 *
 * Two things, both checkable: a measurable result that appears nowhere in the
 * profile, and a factual assertion about the user (an employer, a school, a
 * skill) that appears nowhere in the profile. Everything else the Coach says,
 * advice, judgement, encouragement, is not a claim about the user and is not
 * this guard's business.
 *
 * Market claims ("data analysts in Hanoi earn X") are deliberately out of
 * scope: there is no retrieved corpus in this version to check them against.
 * ADR-002 says so, and the honest thing is to leave it undone rather than to
 * check it badly.
 */

import type { AppState } from "@/lib/actions/types";
import { DEFAULT_CONFIG, type GuardrailConfig } from "@/lib/guardrails/config";
import { messages } from "@/lib/i18n/messages";
import { isCvPaper, isLetterPaper, paragraphsOf } from "@/lib/paper";

export type GroundingFinding = {
  rule: "ungrounded-number" | "ungrounded-claim";
  detail: string;
  sample: string;
};

export type GroundingVerdict =
  | { kind: "allow"; reply: string; findings: GroundingFinding[] }
  | { kind: "revise"; reply: string; findings: GroundingFinding[] };

/**
 * Everything the product knows about the user, as one lowercase haystack.
 *
 * A bag of text rather than a structure, because the question being asked is
 * "does this appear anywhere in what they told us", and every structured
 * version of that answer is the same string search with more steps.
 */
export function profileFacts(state: AppState): string {
  // `string | undefined` rather than `string`: several of these fields are
  // optional in their own types, and a `?? ""` on each would be noise. They
  // are dropped on the way out.
  const parts: (string | undefined)[] = [
    state.profile.identity.name,
    state.profile.identity.targetRole,
    ...state.profile.context.flatMap((row) => [row.label, row.value]),
    ...state.profile.experience.flatMap((entry) => [
      entry.title,
      entry.org,
      entry.period,
      entry.detail,
    ]),
    state.profile.education.school,
    state.profile.education.major,
    state.profile.education.year,
    state.profile.education.gpa,
    ...state.profile.education.courses,
    ...state.profile.documents.flatMap((doc) => [
      doc.label,
      doc.purpose ?? "",
      doc.targetRole ?? "",
      doc.note ?? "",
    ]),
    ...state.paper.flatMap((item) => {
      if (isCvPaper(item)) {
        return [
          item.label,
          ...item.sections.flatMap((section) => [
            section.heading,
            section.body ?? "",
            ...section.entries.flatMap((entry) => [
              entry.title,
              entry.org,
              entry.period,
              entry.detail,
            ]),
          ]),
        ];
      }
      if (isLetterPaper(item)) {
        return [item.label, ...paragraphsOf(item.body)];
      }
      return [item.label, ...item.notes.map((note) => note.text)];
    }),
    ...state.pitch.map((item) => item.body),
  ];
  return parts.filter(Boolean).join("\n").toLowerCase();
}

/**
 * A measurable result, as opposed to a number.
 *
 * "Three months from now" and "two questions" are numbers and neither is a
 * claim about what the user achieved. A percentage, a money amount, or a
 * quantity attached to a verb of improvement is. Getting this line right is
 * the difference between a guard and an irritation.
 */
const MEASURABLE = [
  /\d+(?:[.,]\d+)?\s*%/g,
  /(?:tăng|giảm|rút ngắn|tiết kiệm|cải thiện)[^.?!]{0,20}?(\d+(?:[.,]\d+)?)/giu,
  /(?:increased|reduced|cut|saved|improved|grew)[^.?!]{0,20}?(\d+(?:[.,]\d+)?)/gi,
  /\d[\d.,]*\s*(?:triệu|tỷ|vnd|đ|usd|\$)/giu,
];

/** The numbers in a string, as written. */
function measurables(text: string): string[] {
  const found: string[] = [];
  for (const pattern of MEASURABLE) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) found.push(match[0].trim());
  }
  return [...new Set(found)];
}

/**
 * A number's value, as a comparable string.
 *
 * Not its digits. Stripping punctuation makes "4.0" and "40%" the same string,
 * which is how the first version of this quietly accepted an invented 40% from
 * a profile whose only number was a GPA of 4.0. Thousands separators are
 * removed, decimal commas become points, and the result is a parsed value:
 * 4.0 and 40 are then as different as they should be.
 */
function valueOf(text: string): string | null {
  const cleaned = text
    .replace(/[^\d.,]/g, "")
    // A dot or comma with exactly three digits after it groups thousands.
    .replace(/[.,](?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? String(value) : null;
}

/**
 * Assertions of fact about the user.
 *
 * Deliberately only the forms that state something as already true. "Bạn có
 * thể học SQL" (you could learn SQL) is advice; "bạn đã làm ở VNG" (you worked
 * at VNG) is a claim, and a wrong one is what gets somebody caught out.
 */
const CLAIMS_ABOUT_USER = [
  /(?:bạn đã (?:làm|thực tập|học) (?:ở|tại)|bạn từng làm (?:ở|tại))\s+([^.,;?!\n]{2,40})/giu,
  /(?:you (?:worked|interned|studied) at)\s+([^.,;?!\n]{2,40})/gi,
  /(?:kinh nghiệm của bạn (?:về|với)|bạn có kinh nghiệm (?:về|với))\s+([^.,;?!\n]{2,40})/giu,
  /(?:your experience (?:with|in))\s+([^.,;?!\n]{2,40})/gi,
];

/** Words too common to be evidence of anything. */
const STOPWORDS = new Set([
  "này",
  "đó",
  "công ty",
  "công việc",
  "vị trí",
  "the company",
  "this role",
  "that role",
  "the job",
  "it",
]);

/**
 * Check a reply against what the product actually knows.
 *
 * `userSaid` is the conversation so far. A number the user typed a minute ago
 * is grounded: they supplied it, which is exactly what AC-TRUST-001.2 allows.
 */
export function checkGrounding({
  reply,
  state,
  userSaid = "",
  config = DEFAULT_CONFIG,
}: {
  reply: string;
  state: AppState;
  userSaid?: string;
  config?: GuardrailConfig;
}): GroundingVerdict {
  if (config.strictness === "off") {
    return { kind: "allow", reply, findings: [] };
  }

  const known = `${profileFacts(state)}\n${userSaid.toLowerCase()}`;
  const knownValues = new Set(
    (known.match(/\d[\d.,]*/g) ?? [])
      .map(valueOf)
      .filter((value): value is string => value !== null),
  );
  const findings: GroundingFinding[] = [];

  // AC-TRUST-001.2: no numeric result that is not in the profile or supplied.
  for (const claimed of measurables(reply)) {
    const value = valueOf(claimed);
    if (!value || knownValues.has(value)) continue;
    findings.push({
      rule: "ungrounded-number",
      detail: "a measurable result appears nowhere in the profile or the conversation",
      sample: claimed,
    });
  }

  // AC-TRUST-001.1 and .3: no assertion about the user that traces to nothing.
  for (const pattern of CLAIMS_ABOUT_USER) {
    pattern.lastIndex = 0;
    for (const match of reply.matchAll(pattern)) {
      const subject = match[1]?.trim().toLowerCase();
      if (!subject || STOPWORDS.has(subject)) continue;
      if (known.includes(subject)) continue;
      findings.push({
        rule: "ungrounded-claim",
        detail: "the reply states something about the user that is not in their profile",
        sample: match[0].trim(),
      });
    }
  }

  if (findings.length === 0) return { kind: "allow", reply, findings: [] };

  // Revised, not blocked. The reply has already streamed into view, and the
  // user is better served by being told which part of it is not backed by
  // anything than by having the whole thing disappear.
  return {
    kind: "revise",
    reply: `${reply.trim()}\n\n${messages.guardrails.notGrounded}`,
    findings,
  };
}
