/**
 * Which model serves this request, and whether it should run at all.
 *
 * Pure functions over the registry. Nothing here opens a socket, so the routing
 * policy is testable without a provider, which is the point: the decision that
 * bounds the bill is the one worth having tests for.
 */

import {
  modelsFor,
  type ModelRole,
  type RegisteredModel,
} from "@/lib/ai/registry";

/**
 * How to order the candidates for a role.
 *
 * `preferred` is the declared order in the registry and the default. The
 * blueprint is explicit that cost only wins when policy says so: a free model
 * that takes nine seconds is the wrong answer for a greeting, however cheap.
 */
export type RoutingPolicy = "preferred" | "cheapest" | "fastest";

const LATENCY_ORDER: Record<string, number> = { low: 0, standard: 1, high: 2 };

/** A role with no model behind it is a configuration error, not a default. */
export class RoutingError extends Error {
  readonly role: ModelRole;

  constructor(role: ModelRole, message: string) {
    super(message);
    this.name = "RoutingError";
    this.role = role;
  }
}

/**
 * The models to try for a role, best first.
 *
 * The whole list is returned rather than one model because fallback is part of
 * routing: the caller walks it until one answers.
 */
export function candidates(
  role: ModelRole,
  policy: RoutingPolicy = "preferred",
): RegisteredModel[] {
  const found = modelsFor(role);
  if (found.length === 0) {
    throw new RoutingError(role, `no model is registered for the ${role} role`);
  }
  if (policy === "preferred") return found;

  // Sorting a copy: the registry is the declared order and other callers with
  // other policies read it too.
  const sorted = [...found];
  if (policy === "cheapest") {
    sorted.sort(
      (a, b) =>
        a.cost.inputPerMillion + a.cost.outputPerMillion -
        (b.cost.inputPerMillion + b.cost.outputPerMillion),
    );
  } else {
    sorted.sort((a, b) => LATENCY_ORDER[a.latency] - LATENCY_ORDER[b.latency]);
  }
  return sorted;
}

/** The model that would serve this request. */
export function route(
  role: ModelRole,
  policy: RoutingPolicy = "preferred",
): RegisteredModel {
  return candidates(role, policy)[0];
}

/**
 * Does this request fit the model's context window?
 *
 * Checked here so an oversized request fails locally instead of being sent,
 * refused, and billed as a failed call.
 */
export function withinContext(
  model: RegisteredModel,
  estimatedTokens: number,
): boolean {
  return estimatedTokens <= model.contextWindowTokens;
}

/**
 * Per-session ceilings.
 *
 * Unchanged from what the agent enforced before the gateway existed. A coaching
 * turn is short; the cap exists to bound cost and conversation length, not to
 * fill the model's window.
 */
export const SESSION_CEILINGS = {
  inputTokens: 120_000,
  outputTokens: 12_000,
  /** Past this share of a ceiling the session is downgraded, not refused. */
  downgradeAt: 0.8,
} as const;

/**
 * What the router says about a session that has already spent something.
 *
 * Three outcomes rather than a boolean, because "you have nearly run out" and
 * "you have run out" call for different behaviour: the first should quietly
 * cost less, the second has to stop. Refusing is the honest end state for a
 * runaway loop.
 */
export type LedgerVerdict =
  | { kind: "allow" }
  | { kind: "downgrade"; reason: string }
  | { kind: "refuse"; reason: string };

export type SessionLedger = {
  /** Add what a completed call spent. */
  record: (usage: { inputTokens?: number; outputTokens?: number }) => void;
  /** What the next call is allowed to do. */
  verdict: () => LedgerVerdict;
  spent: () => { inputTokens: number; outputTokens: number };
};

/** A fresh ledger for one session. */
export function newSessionLedger(
  ceilings: { inputTokens: number; outputTokens: number; downgradeAt: number } =
    SESSION_CEILINGS,
): SessionLedger {
  let inputTokens = 0;
  let outputTokens = 0;

  return {
    record(usage) {
      inputTokens += usage.inputTokens ?? 0;
      outputTokens += usage.outputTokens ?? 0;
    },
    spent() {
      return { inputTokens, outputTokens };
    },
    verdict() {
      if (
        inputTokens >= ceilings.inputTokens ||
        outputTokens >= ceilings.outputTokens
      ) {
        return {
          kind: "refuse",
          reason: "the session has reached its token ceiling",
        };
      }
      if (
        inputTokens >= ceilings.inputTokens * ceilings.downgradeAt ||
        outputTokens >= ceilings.outputTokens * ceilings.downgradeAt
      ) {
        return {
          kind: "downgrade",
          reason: "the session is near its token ceiling",
        };
      }
      return { kind: "allow" };
    },
  };
}

/**
 * The policy a session should run under, given what it has already spent.
 *
 * A downgraded session routes by cost rather than by preference, which is the
 * cheapest thing that is still an answer.
 */
export function policyFor(verdict: LedgerVerdict): RoutingPolicy | null {
  if (verdict.kind === "refuse") return null;
  return verdict.kind === "downgrade" ? "cheapest" : "preferred";
}
