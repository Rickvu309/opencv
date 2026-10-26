# Sign in by email code or Google, no password

**Status.** Accepted 2026-10-26.

**Context.** Sign-in today is email and password through better-auth, and mail is only logged. The design says no password is needed. The person uses Google, or an email and a 6-digit code, then a Welcome page. A session-expired overlay offers "Continue as" and "Email me a code".

**Decision.** better-auth's email code plugin replaces the password flow. Codes go out through Resend. The Google button is drawn and shown only when `GOOGLE_CLIENT_ID` is set. The operator signs up as a Google developer later. Passwords are not kept. Sign-up is not a separate screen. The first successful code creates the account and seeds the workspace.

**Consequences.** The password form goes. Until Resend can send from `opencv.me`, the api logs the code. The verify skills sign up through the code on the log sender. Rate limiting on code requests stays on.
