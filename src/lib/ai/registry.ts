/**
 * The set of models the gateway can route to.
 *
 * This is configuration, not architecture. Switching which model answers a
 * coaching turn should be an edit here (or an environment variable), never a
 * change at a call site, which is why no file outside `lib/ai/` names a model
 * id.
 *
 * Ordering matters: within a role, the first entry is the preferred model and
 * the ones after it are the fallbacks, tried in order when the provider errors
 * or is overloaded.
 */

/** What a request is for, which is what the router selects on. */
export type ModelRole = "conversational" | "drafting" | "fast" | "embedding";

/** Typical response speed. Used when a role cares more about speed than depth. */
export type ModelLatency = "low" | "standard" | "high";

/**
 * Price in US dollars per million tokens.
 *
 * These are declared configuration, trued up against the provider's price list
 * rather than read from it. Only their ordering drives routing (the `cheapest`
 * policy), so a stale absolute figure misreports spend but does not misroute.
 */
export type ModelCost = {
  inputPerMillion: number;
  outputPerMillion: number;
};

/** Provider-specific settings applied to a call to this model. */
export type ModelProviderOptions = {
  /** Sampling defaults, applied to the request body by the gateway. */
  sampling?: { temperature?: number; top_p?: number };
};

export type RegisteredModel = {
  id: string;
  role: ModelRole;
  cost: ModelCost;
  latency: ModelLatency;
  contextWindowTokens: number;
  providerOptions: ModelProviderOptions;
};

/**
 * Sampling kept from the previous provider, where temperature 1.0 dropped
 * CJK/Hangul/Cyrillic tokens into Vietnamese in 4 of 6 replies and 0.3 cut it
 * to roughly none. Cheap insurance on a new model until proven unnecessary.
 */
const STEADY_SAMPLING = { temperature: 0.3, top_p: 0.95 } as const;

/**
 * DeepSeek V4 Flash. Probed against the real tool schema on 2026-08-12: a
 * correct tool call in 2 seconds, with the right field name.
 */
const DEEPSEEK_FLASH = {
  id: process.env.OPENPATH_MODEL ?? "deepseek/deepseek-v4-flash-0731",
  cost: { inputPerMillion: 0.07, outputPerMillion: 0.28 },
  latency: "low",
  contextWindowTokens: 1_000_000,
  providerOptions: { sampling: STEADY_SAMPLING },
} as const;

/**
 * Nemotron 3 Ultra. Probed the same day: the same correct tool call, in 9
 * seconds. Slower, larger, and free, which is the shape of a drafting model
 * and of a fallback: nobody minds nine seconds for a cover letter, and nobody
 * minds nine seconds when the alternative is an error.
 */
const NEMOTRON_ULTRA = {
  id: "nvidia/nemotron-3-ultra-550b-a55b:free",
  cost: { inputPerMillion: 0, outputPerMillion: 0 },
  latency: "high",
  contextWindowTokens: 1_000_000,
  providerOptions: { sampling: STEADY_SAMPLING },
} as const;

/**
 * The registry.
 *
 * A model appears once per role it serves. Two entries sharing an id is normal
 * and intended: a model is cheap for a greeting and capable enough for a draft,
 * and the router should be able to prefer it differently in each case.
 */
export const MODEL_REGISTRY: readonly RegisteredModel[] = [
  // A coaching turn: short, conversational, and the user is watching the
  // cursor. Speed first, with the slower model behind it rather than an error.
  { ...DEEPSEEK_FLASH, role: "conversational" },
  { ...NEMOTRON_ULTRA, role: "conversational" },

  // A cover letter or a self-introduction. Nobody is watching a cursor, and
  // the output is something the user takes into a real interview, so the
  // larger model leads here and the fast one is the fallback.
  { ...NEMOTRON_ULTRA, role: "drafting" },
  { ...DEEPSEEK_FLASH, role: "drafting" },

  // Anything where latency is the whole point (a classification, a check).
  { ...DEEPSEEK_FLASH, role: "fast" },

  // Exposed, not used. The gateway publishes an embedding interface because
  // the blueprint says retrieval will consume it; no call site does yet, and
  // this id has not been probed against the provider. The first caller has to
  // verify it before trusting it.
  {
    id: process.env.OPENPATH_EMBEDDING_MODEL ?? "openai/text-embedding-3-small",
    role: "embedding",
    cost: { inputPerMillion: 0.02, outputPerMillion: 0 },
    latency: "low",
    contextWindowTokens: 8_191,
    providerOptions: {},
  },
];

/** Every model registered for a role, in preference order. */
export function modelsFor(role: ModelRole): RegisteredModel[] {
  return MODEL_REGISTRY.filter((model) => model.role === role);
}

/** The roles the registry can actually serve. */
export const REGISTERED_ROLES: readonly ModelRole[] = [
  ...new Set(MODEL_REGISTRY.map((model) => model.role)),
];
