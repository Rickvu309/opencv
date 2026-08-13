/**
 * The half of the input guard that a modified client cannot skip.
 *
 * The browser screens a message before sending it, which is what lets the user
 * see an honest sentence instead of a failed turn. But "the client already
 * checked" is not a property the server can verify, and this is the safety
 * layer, so the same rules are applied again where they cannot be bypassed.
 *
 * Fails closed. A message that trips a rule here does not reach a model, and
 * the turn errors rather than quietly continuing with the offending text
 * removed: at this point something is wrong with the caller, not with the
 * message, and carrying on would hide that.
 */

import type { ClientBase } from "pg";

import { allowanceMessage, checkAllowance, recordTurn } from "@/lib/billing/usage";
import { guardrailConfig } from "@/lib/guardrails/config";
import { carriesInjection, carriesSensitiveData } from "@/lib/guardrails/input";
import { newCollector } from "@/lib/trace/collector";
import { recordTrace, recordViolation } from "@/lib/trace/store";

/** Thrown when a turn is refused before any model call. */
export class GuardrailRefusal extends Error {
  readonly rule: string;

  constructor(rule: string, message: string) {
    super(message);
    this.name = "GuardrailRefusal";
    this.rule = rule;
  }
}

/**
 * Thrown when the account has used its Coach allowance.
 *
 * A different class from a guardrail refusal because it means something
 * different to the user: nothing is wrong with what they asked, they have
 * simply run out. The message is theirs to read.
 */
export class AllowanceReached extends Error {
  readonly vi: string;
  readonly en: string;

  constructor(message: { vi: string; en: string }) {
    super(message.en);
    this.name = "AllowanceReached";
    this.vi = message.vi;
    this.en = message.en;
  }
}

/**
 * Count this turn against the plan, and refuse when there is nothing left.
 *
 * At the channel rather than at the model call, which is the seam the work
 * order names: a turn that is refused here has cost nothing, and the tools the
 * user owns (their CV, their letters, their applications) are untouched,
 * because none of them come through this door.
 */
export async function meterTurn(accountId: string | null): Promise<void> {
  // No account means a local-dev or platform caller, which is not somebody's
  // subscription and must not be billed against one.
  if (!accountId) return;

  const verdict = await checkAllowance(accountId);
  if (verdict.kind === "refuse") {
    throw new AllowanceReached(allowanceMessage(verdict.plan));
  }
  await recordTurn(accountId);
}

/**
 * Screen an inbound turn. Throws to refuse it.
 *
 * The violation is recorded before the throw, because a guard that refuses
 * silently cannot be measured, and the blueprint asks for the guards' own
 * accuracy to be measured rather than assumed.
 */
export async function screenInboundTurn({
  text,
  accountId,
  db,
}: {
  text: string;
  accountId: string | null;
  /** Injected by the tests; production uses the pool. */
  db?: Pick<ClientBase, "query">;
}): Promise<void> {
  const config = guardrailConfig();
  if (config.strictness === "off") return;

  const rule = carriesInjection(text)
    ? "injection"
    : carriesSensitiveData(text)
      ? "sensitive-data"
      : null;
  if (!rule) return;

  await emit({ accountId, rule, text, db }).catch((error) => {
    // The sink is never allowed to change the outcome of a guard. A refusal
    // stands whether or not it was possible to write it down.
    console.error("guardrails: could not record a refusal", error);
  });

  throw new GuardrailRefusal(
    rule,
    rule === "injection"
      ? "the message tries to override the Coach's instructions"
      : "the message carries data the Coach has no need for",
  );
}

async function emit({
  accountId,
  rule,
  text,
  db,
}: {
  accountId: string | null;
  rule: string;
  text: string;
  db?: Pick<ClientBase, "query">;
}): Promise<void> {
  const collector = newCollector({ accountId });
  const violation = collector.violation({
    guard: "input",
    rule,
    severity: "block",
    detail: "refused on the server, after the client should have caught it",
    sample: text,
  });
  const trace = collector.finish();
  await (db ? recordTrace(trace, db) : recordTrace(trace));
  await (db ? recordViolation(violation, db) : recordViolation(violation));
}
