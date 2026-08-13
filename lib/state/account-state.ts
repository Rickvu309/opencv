import type { ClientBase } from "pg";

import { seedState } from "@/lib/actions/seed";
import type { AppState } from "@/lib/actions/types";
import { getPool } from "@/lib/db/client";
import { isLocale, type Locale } from "@/lib/i18n/locale";

/**
 * One account's `AppState`, on the server.
 *
 * ## What changed, and what deliberately did not
 *
 * `lib/actions/persistence.ts` was written with a promise in it: every write
 * funnels through dispatch, so the day a server store exists, one file changes.
 * This is that day, and this is that file's other half. The registry, the
 * reducers and every screen are untouched, which is the whole return on having
 * had a seam.
 *
 * ## Why the account id is a parameter and never a default
 *
 * Every function here takes the account it is acting for. There is no ambient
 * "current account" in this module and no default, because the failure this
 * guards against is the one that matters most in a product with accounts:
 * reading the wrong person's data. A missing argument is a type error at the
 * call site rather than somebody else's profile on the screen.
 *
 * ## Why the whole document is replaced
 *
 * Last-write-wins, as in the browser. Dispatches are serialized through one
 * store, so a partial merge would have nothing to merge against. Two devices
 * editing at once is the case this loses, and it loses it the same way a
 * shared document does: the later save is the one that survives. Recognised,
 * not solved, and the seam is still the place to solve it.
 */

/**
 * A stored blob is untrusted input, exactly as it was in the browser: an older
 * shape, a hand-edited row, or a client sending whatever it likes to the write
 * endpoint. Top level only. Anything deeper is the reducer's problem, and every
 * action parses its own input before touching state.
 */
export function looksLikeState(value: unknown): value is AppState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<AppState>;
  return (
    isLocale(state.locale) &&
    typeof state.profile === "object" &&
    state.profile !== null &&
    Array.isArray(state.todos) &&
    typeof state.plan === "object" &&
    state.plan !== null &&
    Array.isArray(state.resumes) &&
    Array.isArray(state.papers) &&
    Array.isArray(state.pitch) &&
    typeof state.paths === "object" &&
    state.paths !== null
  );
}

/**
 * A stored row, brought up to the current shape.
 *
 * ## The cliff this exists to remove
 *
 * `AppState` gains a top-level field every time the product grows one: `papers`
 * arrived with cover letters, and something else will arrive next. A stored row
 * written before that field existed does not have it, and a strict shape check
 * would call it corrupt.
 *
 * That was survivable in the browser, where the blob was demo data and the cost
 * of rejecting it was a reseed. It is not survivable here, and the failure is
 * worse than losing the row: rejecting it means the page renders the seed, and
 * the user's next click saves that seed **over** their real work. A shape check
 * with no migration behind it is a data-loss bug wearing a safety check.
 *
 * So a row that is merely *older* is filled in from the seed and kept. A row
 * that is genuinely wrong, `todos` holding a string, something that is not an
 * object at all, is still refused, and refusing is still the right answer for
 * those, because there is nothing to salvage.
 *
 * The database migration that backfills the same field is the other half of
 * this. This makes the app correct the moment the code ships; the migration
 * makes the stored rows correct too, so this never has to fill in more than
 * one release's worth of drift.
 */
export function reviveState(value: unknown): AppState | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  // Shallow on purpose. A missing top-level key is what a new release causes;
  // a missing key three levels down is what corruption causes, and quietly
  // patching that would hide it.
  const merged = { ...seedState(), ...(value as Partial<AppState>) };
  return looksLikeState(merged) ? merged : null;
}

/**
 * The account's state, or null when it has never written any.
 *
 * Null rather than the seed, because the caller needs to be able to tell "this
 * account is new" from "this account has state". The read path above turns
 * null into the seed; the write path uses it to decide nothing.
 *
 * A row that does not parse is treated as absent rather than thrown, and the
 * reason is the difference between this and localStorage: a browser blob that
 * cannot be read is one person's demo data, and dropping it costs a reseed.
 * A row here is somebody's real work. So it is left exactly where it is, the
 * account gets a working app, and the row is available for a migration to
 * repair. Nothing is deleted. That is what WO-24's migration note asks for.
 */
export async function readAccountState(
  accountId: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<AppState | null> {
  const { rows } = await db.query<{ state: unknown }>(
    "select state from app_state where account_id = $1",
    [accountId],
  );
  if (!rows[0]) return null;

  // `jsonb` comes back parsed, so there is no JSON.parse to fail here; what
  // can still be wrong is the shape. A row from an older release is filled in
  // rather than refused; see `reviveState` for why that distinction is the
  // difference between an inconvenience and losing somebody's work.
  const revived = reviveState(rows[0].state);
  if (!revived) {
    console.error("app_state: a stored row does not match AppState", { accountId });
    return null;
  }
  return revived;
}

/**
 * Write the account's state, replacing whatever was there.
 *
 * One statement rather than a read, a decision and a write: two clients saving
 * at the same moment would otherwise both find no row and both insert, and one
 * of them would fail on the primary key. `on conflict` makes the database
 * settle it.
 */
export async function writeAccountState(
  accountId: string,
  state: AppState,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<void> {
  await db.query(
    `insert into app_state (account_id, state, updated_at)
     values ($1, $2, now())
     on conflict (account_id) do update
       set state = excluded.state, updated_at = now()`,
    [accountId, JSON.stringify(state)],
  );
}

/**
 * Give a brand new account the state it starts from. AC-ACCT-001.5.
 *
 * Called when the account is created rather than on its first dispatch, so
 * that "this account exists" and "this account has somewhere to keep its work"
 * are true at the same instant. `seedState` is deliberately almost empty: three
 * plan stages, which are the shape of a plan rather than anybody's plan. There
 * was a demo persona here once and every screen quietly read her instead of the
 * person signed in; WO-24 says in as many words not to bring her back.
 */
export async function createAccountState(
  accountId: string,
  locale: Locale | undefined,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<AppState> {
  const state = seedState(isLocale(locale) ? locale : undefined);
  await writeAccountState(accountId, state, db);
  return state;
}

/**
 * What the app should start from for this account: what was stored, or the
 * seed. The one function a page needs.
 */
export async function loadAccountState(
  accountId: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<AppState> {
  return (await readAccountState(accountId, db)) ?? seedState();
}
