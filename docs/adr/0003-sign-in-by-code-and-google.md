# Sign in by email code or Google, no password

**Status.** Accepted 2026-10-26.

**Context.** Today sign-in is email and password through better-auth, and mail is only logged. The design (W1.1 to W1.6) is "No password needed": Google, or email then a 6-digit code, then a Welcome page, with a session-expired overlay that offers "Continue as" and "Email me a code".

**Decision.** better-auth's `emailOTP` and `genericOAuth` (Google) plugins replace the password flow. Passwords are not kept, because the database is reset for release one. Codes go out through Resend from `opencv.me`. Until the operator adds the domain to Resend (their task) and creates the Google OAuth client (their task), the api logs the code and hides the Google button behind missing config. Sign-up is not a separate screen; the first successful code creates the account and seeds the workspace.

**Consequences.** `features/auth/sign-up-form.tsx` and the password form go. The verify skills sign up through the code on the log sender. Rate limiting on code requests stays on.
