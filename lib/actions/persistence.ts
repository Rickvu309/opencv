import { isLocale } from "@/lib/i18n/locale";
import { seedState } from "./seed";
import type { AppState } from "./types";

/**
 * Where the user's state lives between visits.
 *
 * ## The swap this file was waiting for
 *
 * This module used to open with an argument for the browser, and with a
 * promise: every write funnels through `dispatch`, so this is the only file
 * that has to change when a store both browsers can reach exists. That store
 * exists now, and this is the change. No reducer moved. No screen moved. The
 * registry does not know this happened.
 *
 * ## Two stores, and the line between them
 *
 * - **Signed in:** the account's row in Postgres. It follows the person to
 *   another device, which is the entire point, and it is the only copy.
 * - **Signed out:** localStorage, exactly as before. The public landing no
 *   longer changes language; an anonymous visitor's locale is the browser
 *   guess until they sign in. Onboarding is where they can still switch.
 *
 * There is no syncing between the two. A signed-in session never reads the
 * local copy, so nothing anonymous can leak into an account, and WO-24 is
 * explicit that browser-local demo data is not carried over.
 *
 * ## Why writes are coalesced
 *
 * localStorage was free and synchronous. A row in Southeast Asia is neither.
 * Typing a CV line dispatches on every keystroke, and a request each would be
 * both slow and pointless, because only the last one's contents survive
 * anyway. So writes collapse into one request per quiet moment, and the tab
 * flushes what it is holding before it closes.
 */

/**
 * Bumped when `AppState`'s shape changes incompatibly, for the local copy only.
 *
 * The old comment here said a stored blob from an older shape is discarded
 * rather than migrated, because the cost of dropping it is a reseed. That is
 * still true of *this* key, which holds an anonymous visitor's language choice
 * and nothing else. It is emphatically not true of an account's row, which is
 * somebody's real work: a shape change there is a migration
 * (`lib/db/migrations/`), never a delete.
 */
export const STORAGE_KEY = "openpath:state:v3";

const ENDPOINT = "/api/state";

/**
 * Whether there is an account behind this tab.
 *
 * Set once from the server render rather than sniffed from a cookie, because
 * the cookie is `httpOnly` and the client cannot see it, which is the point of
 * it being `httpOnly`.
 */
let signedIn = false;
/** When false, saves are refused rather than written to the wrong store. */
let writable = true;

export function configurePersistence(options: {
  signedIn: boolean;
  writable?: boolean;
}): void {
  signedIn = options.signedIn;
  writable = options.writable ?? true;
}

/**
 * A stored blob is untrusted input: hand-edited, half-written by a killed tab,
 * or left over from a build that shaped `AppState` differently. This checks the
 * top level only. Anything deeper is the reducer's problem, and every action
 * parses its own input before touching state.
 */
function looksLikeState(value: unknown): value is AppState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<AppState>;
  return (
    isLocale(state.locale) &&
    typeof state.profile === "object" &&
    state.profile !== null &&
    Array.isArray(state.resumes) &&
    Array.isArray(state.papers) &&
    Array.isArray(state.pitch)
  );
}

/**
 * A local blob, brought up to the current shape.
 *
 * The same shallow fill-in the account store does, and here for a smaller
 * reason: this copy only ever holds an anonymous visitor's language choice, so
 * discarding it costs almost nothing. It is done anyway because two rules for
 * "what happens when the shape moves on" is one rule too many, and the cheap
 * case is the one where a divergence goes unnoticed.
 */
function revive(value: unknown): AppState | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const merged = { ...seedState(), ...(value as Partial<AppState>), locale: "en" };
  return looksLikeState(merged) ? merged : null;
}

/**
 * The state to start from.
 *
 * `fromServer` is the signed-in account's state, rendered into the page by the
 * root layout. When it is present it simply wins: it is authoritative, it is
 * already here, and it costs no request. When it is absent nobody is signed in,
 * and this falls back to the local copy exactly as it always did.
 */
export function loadState(fromServer?: AppState | null): AppState {
  if (fromServer) return fromServer;
  if (typeof window === "undefined") return seedState();

  // A first visit gets an empty English seed. Nothing is stored yet.
  const fresh = () => seedState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh();

    // A blob we cannot read is worse than none, so both failures below discard
    // it. Keeping it means re-failing this on every load forever, and the user
    // has no way to clear it.
    const revived = revive(JSON.parse(raw));
    if (!revived) {
      clearState();
      return fresh();
    }
    return revived;
  } catch {
    // Malformed JSON, or storage itself refusing to answer (private mode).
    // Losing persistence is not a reason to fail to render the app.
    clearState();
    return fresh();
  }
}

/* ── The write queue ─────────────────────────────────────────────────────── */

/** Long enough to swallow a burst of keystrokes, short enough to feel instant. */
const QUIET_MS = 700;

let pending: AppState | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let sending = false;
let waiting: ((landed: boolean) => void)[] = [];

async function put(state: AppState): Promise<boolean> {
  try {
    const response = await fetch(ENDPOINT, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state }),
      // The cookie is same-origin and `httpOnly`; this is the default, said
      // out loud because a save that quietly went out unauthenticated would
      // look exactly like a save that worked.
      credentials: "same-origin",
    });
    return response.ok;
  } catch {
    // Offline, or the server is down. The app keeps working from memory.
    return false;
  }
}

function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void send(), QUIET_MS);
}

async function send(): Promise<void> {
  timer = null;
  // One request at a time. A second would race the first and could land the
  // older state last, which is the one failure a last-write-wins store cannot
  // tolerate. The `finally` picks up anything that arrived meanwhile.
  if (sending || !pending) return;

  const state = pending;
  pending = null;
  const told = waiting;
  waiting = [];
  sending = true;

  let landed = false;
  try {
    landed = await put(state);
  } finally {
    sending = false;
    for (const resolve of told) resolve(landed);
    if (pending) schedule();
  }
}

/**
 * Persist the state. Resolves false if the write did not land.
 *
 * Several dispatches in one burst share one request and one answer, which is
 * what the caller wants: the warning is about having stopped remembering, not
 * about a particular keystroke.
 */
export function saveState(state: AppState): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  // Signed in, but the account's row never arrived. Writing the seed to the
  // server would destroy their work; writing it to the browser would mix the
  // two stores. Refuse and keep whatever is in memory.
  if (!writable) return Promise.resolve(false);

  if (!signedIn) {
    // The anonymous path stays synchronous and local, as it always was.
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }

  pending = state;
  return new Promise<boolean>((resolve) => {
    waiting.push(resolve);
    schedule();
  });
}

/**
 * Send whatever is still queued, now, because the tab is going away.
 *
 * `sendBeacon` rather than `fetch`: a browser tearing down a page cancels
 * outstanding requests, and the beacon is the one thing it promises to deliver
 * anyway. It can only POST, which is why the endpoint accepts POST as well as
 * PUT.
 */
export function flushState(): void {
  if (typeof window === "undefined" || !signedIn || !writable || !pending) return;
  if (timer) clearTimeout(timer);
  timer = null;

  const body = JSON.stringify({ state: pending });
  pending = null;
  try {
    const sent = navigator.sendBeacon?.(
      ENDPOINT,
      new Blob([body], { type: "application/json" }),
    );
    if (sent) return;
  } catch {
    // Fall through to the fetch below.
  }
  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => {});
}

/** Forget the local copy. Never touches an account's row. */
export function clearState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do: the caller's next write will overwrite it anyway.
  }
}
