/**
 * The collector for whatever the server is doing right now.
 *
 * ## Why an AsyncLocalStorage rather than a parameter
 *
 * A model call happens four or five frames below the code that knows which
 * turn it belongs to: a guard calls the gateway, the gateway picks a model, the
 * AI SDK calls the middleware. Threading a collector through all of that means
 * every one of those signatures grows a parameter it does not otherwise care
 * about, and the first function that forgets to pass it silently loses the
 * span.
 *
 * Server-side only. `node:async_hooks` does not exist in the browser, and the
 * browser has its own way of knowing which turn it is in: it started it.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import type { Collector } from "@/lib/trace/collector";

const storage = new AsyncLocalStorage<Collector>();

/** Run something with this collector bound as the current one. */
export function withTrace<T>(collector: Collector, run: () => T): T {
  return storage.run(collector, run);
}

/**
 * The bound collector, or null.
 *
 * Null is normal and not an error: a model call made outside any traced
 * operation has nothing to attach to, and inventing an orphan trace for it
 * would fill the table with rows that answer no question.
 */
export function currentCollector(): Collector | null {
  return storage.getStore() ?? null;
}
