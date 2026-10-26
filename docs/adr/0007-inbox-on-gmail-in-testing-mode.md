# Inbox on a mail provider, with a fake source for local runs

**Status.** Accepted 2026-10-26.

**Context.** The Inbox flow reads recruiter emails, matches them to Jobs, drafts replies and sends them. Reading Gmail needs a restricted scope that Google reviews. Until that review finishes, an OAuth app runs in testing mode for named accounts.

**Decision.** Inbox is built on a mail provider interface. Local runs use a fake source. The Gmail provider is used when `GOOGLE_CLIENT_ID` is set. Nothing is sent without the person's click. The api stores only what the surface shows.

**Consequences.** The verify skills use the fake mail source. A live Gmail check waits until `GOOGLE_CLIENT_ID` is set. The operator signs up as a Google developer later. See `docs/adr/0003-sign-in-by-code-and-google.md`.
