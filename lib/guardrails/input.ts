/**
 * What comes in, before a model sees it.
 *
 * Three jobs, in the order the blueprint lists them: refuse an attempt to turn
 * the Coach against its own instructions, redact sensitive data the product has
 * no need for, and decline what is not a career question.
 *
 * ## The failure mode this file is written against
 *
 * Not "somebody gets through". A guard that refuses real questions is worse
 * than no guard, because a student who asks a normal thing and gets refused
 * cannot tell that apart from a broken product, and they do not come back. So
 * every pattern here is narrow, and every one of them has a test proving an
 * innocent sentence survives it.
 */

import { messages } from "@/lib/i18n/messages";
import type { Msg } from "@/lib/i18n/locale";
import type { GuardrailConfig } from "@/lib/guardrails/config";
import { DEFAULT_CONFIG } from "@/lib/guardrails/config";

/** One thing a guard objected to. */
export type InputFinding = {
  rule: "injection" | "sensitive-data" | "out-of-scope" | "over-budget";
  detail: string;
  sample?: string;
};

export type InputVerdict =
  | { kind: "allow"; text: string; findings: [] }
  /** Safe once the marked spans are gone. `text` is what should be sent. */
  | { kind: "redact"; text: string; findings: InputFinding[] }
  /** Not a career question. `reply` is the answer, and no model call is needed. */
  | { kind: "redirect"; reply: Msg; findings: InputFinding[] }
  /** Nothing is sent. `reply` says why. */
  | { kind: "refuse"; reply: Msg; findings: InputFinding[] };

/**
 * A word boundary that works in Vietnamese.
 *
 * `\b` is defined against ASCII `\w`, so in "mình nên đầu tư" there is no
 * boundary before "đ": both sides are non-word characters as far as the engine
 * is concerned, and `/\b(đầu tư)\b/` silently never matches. Every Vietnamese
 * pattern in this file was written that way first, and every one of them was
 * dead until a test said so. These lookarounds use Unicode letter and number
 * classes instead, which is what `\b` means everywhere except in a regex.
 */
function phrase(...alternatives: string[]): RegExp {
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${alternatives.join("|")})(?![\\p{L}\\p{N}])`,
    "iu",
  );
}

/**
 * Attempts to overwrite the Coach's instructions.
 *
 * The narrow family: telling it to disregard what it was told, telling it what
 * it now is, or asking it to recite its own instructions. None of these has a
 * benign reading in a conversation about somebody's career, which is what makes
 * refusing them safe.
 *
 * The Vietnamese ones require a word pointing at *the Coach's* instructions
 * ("trước đó", "của bạn", "hệ thống"). Without that, "mình quên hướng dẫn nộp
 * hồ sơ rồi" reads as an injection, and refusing to help somebody who forgot
 * the application instructions is the exact false positive this guard must not
 * produce.
 */
const INJECTION = [
  /\b(ignore|disregard|forget)\b[^.?!]{0,30}\b(previous|prior|above|earlier|all)\b[^.?!]{0,20}\b(instruction|prompt|rule|direction)/i,
  phrase(
    "(?:bỏ qua|phớt lờ|đừng theo|không cần theo)[^.?!]{0,25}(?:hướng dẫn|chỉ dẫn|quy tắc|lệnh)[^.?!]{0,25}(?:trước đó|bên trên|của bạn|hệ thống)",
  ),
  phrase(
    "(?:bỏ qua|phớt lờ)[^.?!]{0,10}(?:mọi|tất cả)[^.?!]{0,10}(?:hướng dẫn|chỉ dẫn|quy tắc)",
  ),
  /\byou are now\b|\bfrom now on,? you\b|\bact as (?:a|an) \w+ (?:with no|without) (?:restriction|limit|rule)/i,
  /\b(reveal|print|repeat|show)\b[^.?!]{0,25}\b(system prompt|your instructions|initial prompt)\b/i,
  phrase("(?:cho xem|đọc|in ra)[^.?!]{0,25}(?:prompt hệ thống|hướng dẫn hệ thống)"),
  /<\|?(?:im_start|system)\|?>/i,
];

/**
 * Data the product has no use for.
 *
 * Deliberately three things and not a general PII sweep. OpenPath is a CV
 * builder: it holds names, emails, phone numbers and employers on purpose, and
 * a guard that redacted those would break the feature it is meant to protect.
 * What it has never needed is a national id, a bank or card number, or a
 * password, and each of those is a real harm if it lands in a model's context.
 */
const SENSITIVE: { rule: string; pattern: RegExp; replacement: string }[] = [
  {
    // Vietnamese CCCD/CMND: 9 to 12 digits, announced by name. The gap allows
    // for "CCCD của mình là", which is longer than it looks.
    rule: "national-id",
    pattern:
      /(?:cccd|cmnd|căn cước|chứng minh nhân dân|national id)\D{0,20}(\d[\d\s.-]{7,16}\d)/giu,
    replacement: "[đã ẩn]",
  },
  {
    rule: "bank-number",
    pattern:
      /(?:số thẻ|thẻ tín dụng|tài khoản ngân hàng|card number|credit card|bank account|iban)\D{0,20}(\d[\d\s.-]{10,22}\d)/giu,
    replacement: "[đã ẩn]",
  },
  {
    rule: "password",
    pattern: /(?:mật khẩu|password|passcode|mã pin)\s*(?:là|is|:|=)\s*(\S+)/giu,
    replacement: "[đã ẩn]",
  },
];

/**
 * Questions this product is not fit to answer.
 *
 * "Not fit" rather than "not interested": REQ-TRUST-003 draws the line at legal,
 * medical and personal-financial advice, all three of which a confident wrong
 * answer can genuinely hurt somebody with.
 *
 * Money is where this is hardest. "How much does an intern earn" and "which
 * stock should I buy" are both about money and only one of them is out of
 * scope, so the financial patterns name the act of investing or borrowing
 * rather than the subject of money.
 */
const OUT_OF_SCOPE = [
  phrase("(?:kiện|khởi kiện|luật sư|tố cáo)"),
  phrase("(?:vi phạm pháp luật|theo luật lao động thì)"),
  /\b(sue|lawsuit|lawyer|legal advice|is it legal|labou?r law)\b/i,
  phrase("(?:triệu chứng|chẩn đoán|bác sĩ)"),
  phrase("(?:uống thuốc|nên uống|liều dùng)"),
  /\b(symptom|diagnos\w*|prescription|medication|see a doctor)\b/i,
  phrase("(?:đầu tư|chứng khoán|cổ phiếu|vay tiền|lãi suất)"),
  /\b(invest|investing|stocks? to buy|crypto|mortgage|which loan|financial advice)\b/i,
];

const g = messages.guardrails;

/** Screen an incoming message. */
export function screenInput({
  text,
  config = DEFAULT_CONFIG,
}: {
  text: string;
  config?: GuardrailConfig;
}): InputVerdict {
  if (config.strictness === "off") return { kind: "allow", text, findings: [] };

  for (const pattern of INJECTION) {
    const match = pattern.exec(text);
    if (!match) continue;
    return {
      kind: "refuse",
      reply: g.injectionRefused,
      findings: [
        {
          rule: "injection",
          detail: "the message tries to override the Coach's instructions",
          sample: match[0],
        },
      ],
    };
  }

  // Scope before redaction: a legal question with a national id in it is
  // declined, and declining is the stronger answer, so there is nothing to
  // redact afterwards.
  for (const pattern of OUT_OF_SCOPE) {
    const match = pattern.exec(text);
    if (!match) continue;
    return {
      kind: "redirect",
      reply: g.outOfScope,
      findings: [
        {
          rule: "out-of-scope",
          detail: "legal, medical or personal-financial advice was asked for",
          sample: match[0],
        },
      ],
    };
  }

  const findings: InputFinding[] = [];
  let redacted = text;
  for (const { rule, pattern, replacement } of SENSITIVE) {
    redacted = redacted.replace(pattern, (whole, value: string) => {
      findings.push({
        rule: "sensitive-data",
        detail: `a ${rule} was removed before the model saw it`,
        sample: rule,
      });
      return whole.replace(value, replacement);
    });
  }

  if (findings.length > 0) {
    return { kind: "redact", text: redacted, findings };
  }
  return { kind: "allow", text, findings: [] };
}

/**
 * Does this message still carry what should already have been redacted?
 *
 * The server-side half. The browser redacts before sending, so anything that
 * arrives still carrying a card number either bypassed that or was never sent
 * by our client, and either way the honest response is to refuse rather than to
 * quietly clean it up and carry on.
 */
export function carriesSensitiveData(text: string): boolean {
  return SENSITIVE.some(({ pattern }) => {
    // `exec` on a global regex is stateful, so each check starts from zero.
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

/** Does this message try to override the Coach's instructions? */
export function carriesInjection(text: string): boolean {
  return INJECTION.some((pattern) => pattern.test(text));
}
