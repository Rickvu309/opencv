# English only, with the EN/VI switch present and inert

**Status.** Accepted 2026-10-26. Supersedes archived ADR-0008's "no toggle" line.

**Context.** Archived ADR-0008 said English chrome and no language toggle. The design shows EN/VI on sign-in and a Language row in Settings.

**Decision.** Release one ships English copy only. The switch and the setting are built as drawn and stored on the profile, and nothing reads them yet. Vietnamese copy is a later program.

**Consequences.** The checker allows the inert switch. A later translation program reads the stored preference.
