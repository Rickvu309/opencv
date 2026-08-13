/**
 * What goes out, before the user believes it.
 *
 * ## The check this file exists for
 *
 * "Mình thêm việc đó vào danh sách rồi nhé" when nothing was added. The
 * instruction file has asked the Coach not to do that since the day it was
 * written, and asking has never been the same as knowing. Every screen the
 * Coach edits is a screen the user then stops checking, so a single false claim
 * costs more than a hundred cautious replies.
 *
 * The turn is the unit here, not the sentence: the claim is in the text and the
 * evidence is in the tool results, so this runs when both are known.
 *
 * Grounding claims about the user against their profile is a separate guard.
 * See `lib/guardrails/grounding.ts`.
 */

import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/locale";
import { DEFAULT_CONFIG, type GuardrailConfig } from "@/lib/guardrails/config";

export type OutputFinding = {
  rule: "false-action-claim" | "out-of-scope-advice" | "over-promise";
  detail: string;
  sample?: string;
};

export type OutputVerdict =
  /** Shown as written. `findings` may still be non-empty: seen, recorded, not rewritten. */
  | { kind: "allow"; reply: string; findings: OutputFinding[] }
  /** The reply is shown with a correction appended. */
  | { kind: "revise"; reply: string; findings: OutputFinding[] }
  /** The reply is not shown at all. */
  | { kind: "block"; reply: string; findings: OutputFinding[] };

/**
 * Sentences that assert a change happened.
 *
 * Past tense and first person, which is the shape of a claim rather than of an
 * offer. "Mình sẽ thêm" (I will add) and "bạn có thể thêm" (you can add) are
 * deliberately not here: neither one tells the user something is already done.
 */
const CLAIMS_A_CHANGE = [
  /\bmình (?:đã |)(?:thêm|cập nhật|sửa|tạo|xoá|xóa|lưu|đổi|viết)\b[^.?!]{0,40}(?:rồi|xong)\b/i,
  /\bmình đã (?:thêm|cập nhật|sửa|tạo|xoá|xóa|lưu|đổi|viết)\b/i,
  /\b(?:đã (?:thêm|cập nhật|tạo|lưu|xoá|xóa)) (?:vào|cho|giúp) bạn\b/i,
  /\bI(?:'ve| have) (?:added|updated|created|saved|removed|deleted|changed|written)\b/i,
  /\bI (?:added|updated|created|saved|removed|deleted|changed) (?:it|that|your)\b/i,
];

/** Advice the product is not fit to give, if it slipped past the input guard. */
const OUT_OF_SCOPE_ADVICE = [
  /\b(bạn nên kiện|bạn có quyền khởi kiện|theo luật thì bạn)\b/i,
  /\b(you should sue|legally,? you (?:can|should)|under the law,? you)\b/i,
  /\b(bạn nên uống|liều dùng|nên đi khám ngay vì bạn bị)\b/i,
  /\b(you should take \d|the dosage|you likely have)\b/i,
  /\b(bạn nên đầu tư vào|nên mua cổ phiếu|lãi suất tốt nhất là)\b/i,
  /\b(you should invest in|buy shares in|the best interest rate)\b/i,
];

/** Promises the Coach is in no position to make. */
const OVER_PROMISE = [
  /\b(chắc chắn (?:sẽ |)(?:đậu|trúng tuyển|được nhận)|bạn sẽ được nhận)\b/i,
  /\b(you(?:'ll| will) (?:definitely |certainly |)get (?:the job|hired|an offer))\b/i,
  /\b(lương (?:của bạn |)sẽ là|bạn sẽ được trả)\b\s*[\d]/i,
  /\b(you(?:'ll| will) be paid|your salary will be)\b\s*[\d$]/i,
];

/** What the turn actually did, as far as the client can see. */
export type TurnToolResult = {
  action: string;
  ok: boolean;
};

/**
 * Check a finished reply.
 *
 * `locale` decides which language the correction is written in, and it is the
 * reply's language rather than the app's: appending an English sentence to a
 * Vietnamese reply would read as a bug even when the correction is right.
 */
export function checkOutput({
  reply,
  toolResults = [],
  locale,
  config = DEFAULT_CONFIG,
}: {
  reply: string;
  toolResults?: TurnToolResult[];
  locale: Locale;
  config?: GuardrailConfig;
}): OutputVerdict {
  if (config.strictness === "off") {
    return { kind: "allow", reply, findings: [] };
  }

  const findings: OutputFinding[] = [];
  const succeeded = toolResults.some((result) => result.ok);

  // AC-TRUST-002.1 and .2. The claim is only a violation when nothing in the
  // turn backs it up; the same sentence after a successful action is the Coach
  // doing exactly what it should.
  if (!succeeded) {
    for (const pattern of CLAIMS_A_CHANGE) {
      const match = pattern.exec(reply);
      if (!match) continue;
      findings.push({
        rule: "false-action-claim",
        detail: "the reply says a change was made, and no action succeeded",
        sample: match[0],
      });
      break;
    }
  }

  for (const pattern of OUT_OF_SCOPE_ADVICE) {
    const match = pattern.exec(reply);
    if (!match) continue;
    findings.push({
      rule: "out-of-scope-advice",
      detail: "the reply gives legal, medical or financial advice",
      sample: match[0],
    });
    break;
  }

  for (const pattern of OVER_PROMISE) {
    const match = pattern.exec(reply);
    if (!match) continue;
    findings.push({
      rule: "over-promise",
      detail: "the reply promises an outcome the Coach cannot promise",
      sample: match[0],
    });
    break;
  }

  if (findings.length === 0) return { kind: "allow", reply, findings: [] };

  const claimedFalsely = findings.some(
    (finding) => finding.rule === "false-action-claim",
  );

  // A false claim of action is the one violation worth contradicting in front
  // of the user, because they are about to go and look at a screen that has
  // not changed. The other two are recorded and, under `strict`, corrected.
  if (claimedFalsely) {
    return {
      kind: "revise",
      reply: `${reply.trim()}\n\n${messages.guardrails.noActionTaken[locale]}`,
      findings,
    };
  }

  if (config.strictness === "strict") {
    return {
      kind: "revise",
      reply: `${reply.trim()}\n\n${messages.guardrails.outOfScope[locale]}`,
      findings,
    };
  }

  // Standard strictness: seen, recorded, not rewritten. The reply is unhelpful
  // rather than harmful, and rewriting a model's words on a maybe is its own
  // kind of dishonesty. The findings still travel, so the sink counts what the
  // guard noticed and did not act on.
  return { kind: "allow", reply, findings };
}
