/**
 * How hard the guards come down.
 *
 * Configuration rather than a constant because the blueprint requires
 * strictness be variable for rollout and testing: @Feature Flags & Experiments
 * will read it later, and until then an environment variable is enough to turn
 * a guard off in an incident without a deploy.
 */

export type Strictness =
  /** Nothing is checked. For an incident, not for normal running. */
  | "off"
  /** The default: refuse what is clearly unsafe, allow what is merely unusual. */
  | "standard"
  /** Also flags the borderline cases rather than letting them through. */
  | "strict";

export type GuardrailConfig = {
  strictness: Strictness;
};

const STRICTNESS: Strictness[] = ["off", "standard", "strict"];

export const DEFAULT_CONFIG: GuardrailConfig = { strictness: "standard" };

/**
 * The configured strictness.
 *
 * An unrecognised value falls back to `standard` rather than to `off`. A typo
 * in an environment variable must never be the thing that silently disables
 * the safety layer.
 */
export function guardrailConfig(
  env: Record<string, string | undefined> = process.env,
): GuardrailConfig {
  const value = env.OPENPATH_GUARDRAILS;
  return {
    strictness: STRICTNESS.includes(value as Strictness)
      ? (value as Strictness)
      : "standard",
  };
}
