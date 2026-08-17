/**
 * Will this prompt fit, and leave room for an answer?
 *
 * The division of labour the blueprint sets out: the gateway's router owns the
 * per-session cap at the model call, and the input guard owns prompt-level
 * accounting. This is the second half. Its job is to catch the request that
 * would technically be under the cap but leave the model no room to reply,
 * which reads to the user as a Coach that stopped mid-sentence.
 */

import { SESSION_CEILINGS } from "@/lib/ai/router";

/**
 * Roughly how many tokens a string is.
 *
 * Four characters per token is the usual English approximation and runs about
 * 25% low on Vietnamese, where diacritics push the byte count up. Low is the
 * wrong direction to be wrong in for a budget check, so the divisor is 3: this
 * over-estimates, and over-estimating means refusing slightly early rather than
 * truncating a reply the user was waiting for.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

/** How much room a reply needs before a request is worth sending. */
export const RESERVED_FOR_REPLY = 1_500;

export type BudgetVerdict =
  | { kind: "allow"; estimatedTokens: number }
  | { kind: "refuse"; estimatedTokens: number; reason: string };

/**
 * AC-TRUST-004.3: a request that would exceed the budget is refused rather
 * than allowed to run unbounded.
 */
export function fitsBudget({
  message,
  context = "",
  spentInputTokens = 0,
  ceiling = SESSION_CEILINGS.inputTokens,
  contextWindowTokens,
}: {
  message: string;
  /** The serialized `CoachContext` travelling with the turn. */
  context?: string;
  spentInputTokens?: number;
  ceiling?: number;
  /** The model's window, when the caller knows which model will run. */
  contextWindowTokens?: number;
}): BudgetVerdict {
  const estimatedTokens = estimateTokens(message) + estimateTokens(context);

  if (contextWindowTokens !== undefined &&
      estimatedTokens + RESERVED_FOR_REPLY > contextWindowTokens) {
    return {
      kind: "refuse",
      estimatedTokens,
      reason: "the request does not fit the model's context window",
    };
  }

  const remaining = ceiling - spentInputTokens;
  if (estimatedTokens + RESERVED_FOR_REPLY > remaining) {
    return {
      kind: "refuse",
      estimatedTokens,
      reason: "the session has no room left for this request and a reply",
    };
  }

  return { kind: "allow", estimatedTokens };
}
