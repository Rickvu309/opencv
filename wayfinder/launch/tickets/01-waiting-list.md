# The waiting list: where an email actually goes

- **Type:** `wayfinder:task`
- **Status:** closed
- **Assignee:** minhquanvu3902@gmail.com (via Claude)
- **Blocked by:** —
- **Map:** [Map, OpenPath landing and the waiting list](../map.md)

## Question

"On server side we need waiting list data too." There is no server store. The app has
never written a byte outside the user's own browser, deliberately: `AppState` lives in
`localStorage` because one shared demo account plus a server store would show every
visitor everyone else's edits.

A waiting list is the opposite case. It is **not** per-visitor state; it is one list the
team reads. So this is the first thing this product genuinely has to persist centrally,
and the decision cannot be dodged the way persistence was.

### 1. Where

Checked: `vercel storage` is not a subcommand in CLI 50.28.0, and the project has no
store provisioned. So every option needs one action in the dashboard, exactly like
`NVIDIA_API_KEY` did. Candidates:

- **Vercel Blob**, one store, one `BLOB_READ_WRITE_TOKEN`, an npm package. Append-friendly
  for a list this size, no schema, no connection pooling in a serverless function.
- **Postgres via the marketplace** (Neon), a real table with a unique index doing the
  dedupe for free. More to operate for a list that may never exceed a few hundred rows.
- **A third-party form service.** Fastest, and it puts the one piece of user data this
  product collects on someone else's terms.

Pick one, and pick it for the size of the problem rather than the size of the ambition.

### 2. The shape of a row

At minimum the address and when it arrived. Worth deciding now because changing it later
means migrating rows a human has already read: does the row record **where** the person
joined from (landing page or end of demo)? That is the only signal available about intent,
and it costs one field.

### 3. What the server has to refuse

The address is the only input this product takes from an unauthenticated stranger, so the
route is a real trust boundary:

- Validate on the server, always. A client-side check is a courtesy to the user, not a
  control.
- **The same address twice must not create two rows.** Decide whether the second submit
  is an error the user sees or a quiet success; quiet success is usually kinder and it
  also removes a way to probe who is already on the list.
- Bound it. An open POST endpoint on a public page invites junk, and every row costs
  storage and credibility.

### 4. Never lose an address silently

If the store is unreachable or unconfigured, the route must not return success. A visitor
who typed their email and saw a tick, whose address went nowhere, is worse than one who
saw an honest error and tried again.

## Resolution, 2026-08-04

Closed. An address submitted on the deployed domain is stored, deduped and readable.

### 1, resolved: a **private** Vercel Blob store

Chosen over Postgres because a few hundred addresses need no schema, no migrations and no
connection pooling inside a serverless function, and over a third-party form because this
is the one piece of user data the product collects.

Provisioned from here rather than handed over as a dashboard chore: `vercel blob
create-store`, then connected to the project through the API, so `BLOB_READ_WRITE_TOKEN`
now exists in **Production, Preview and Development**. That is the first time all three
have been set, which also quietly fixes the Preview gap *Ship it* had to leave open.

**The first store I made was wrong and was deleted.** Blob defaults to `access: "public"`,
which means every blob is readable by URL. That is not a place to keep strangers' email
addresses. Replaced with a private store; the SDK now refuses a `public` write against it,
which is the right way round for a setting that matters.

### 2, resolved: address, source, timestamp

`{ email, source, joinedAt }`. `source` is `"landing"` or `"end-of-demo"` and costs one
field for the only signal available about intent: whether they joined cold or after seeing
the product work.

### 3, resolved: the pathname does the deduping

One blob per address, named `waitlist/<sha256 of the normalized address>.json`. Two
consequences worth the choice:

- **Dedupe is structural.** The same address always lands on the same pathname and `put`
  overwrites. A list-then-append would let two simultaneous submits create two rows; this
  cannot.
- **The address is not in the pathname.** Even inside a private store, pathnames are the
  part most likely to surface in a log or a dashboard.

Normalization is case and surrounding space only. Collapsing dots would merge
`minh.anh@` and `minhanh@`, which Gmail treats as one inbox and most providers do not, so
it would silently merge two different people.

A repeat submission returns **exactly the same response** as a new one. Saying "you are
already on the list" confirms membership to anyone who can type an address, and it is a
small unkindness to someone who forgot.

### 4, resolved: no silent success

The route returns 503 when the token is missing and 502 when the write throws, and logs
the failure **without the address**. A visitor who saw a tick while their address went
nowhere is worse than one who saw an honest error.

Also landed: server-side validation that runs whether or not the client bothered, and a
per-instance throttle that is honest in its own comment about not being a real rate limit.

### Verified

| Check | Result |
| --- | --- |
| Malformed address, client bypassed | `400` with a Vietnamese message, from `curl` on production |
| `Prod.Test@Example.com` then `  prod.test@example.com ` | `200` twice, **one row**, normalized, first source kept |
| Store access | `private`; the public one was deleted |
| Test rows | Cleared; the list is empty for real visitors |

Six tests cover what the validator must accept as well as what it must refuse, because
rejecting a real address is the expensive mistake.
## Exit criterion

An email submitted on the deployed domain is readable by the team afterwards, survives a
redeploy, and submitting the same address twice leaves one row. A malformed address is
refused by the server even when the client check is bypassed.
