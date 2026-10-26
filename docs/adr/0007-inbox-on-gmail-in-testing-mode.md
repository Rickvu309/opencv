# Inbox on Gmail ships in Google testing mode while the scope review runs

**Status.** Accepted 2026-10-26.

**Context.** The Inbox flow (W2.1 to W2.4) reads recruiter emails from a connected Gmail account, matches them to Jobs, drafts replies and sends them. Reading Gmail needs a restricted scope that Google reviews, which takes weeks and needs a privacy page and a demo video. Until approved, an OAuth app runs in testing mode for up to 100 named accounts.

**Decision.** Build Inbox now. Ship it in testing mode to the operator's named accounts. The operator runs Google's review in parallel as their task. The api asks for the narrowest scopes that work (read-only mail, send, calendar events) and stores only what the surface shows. Nothing is sent without the person pressing Send.

**Consequences.** A Google Cloud project, OAuth client and consent screen are operator tasks before the track can be verified live. The verify skills use a fake mail source.
