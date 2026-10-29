# Production recovery

Production sign-in recovery needs these checks; a local OTP or HTTP 200 is insufficient.

| Rule                                                                                                                       | Enforced by                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| The API production build is not run before merge                                                                           | Nothing runs `pnpm --filter api... run build` at merge time. Run it by hand when an API change needs it |
| A sign-in recovery receipt requires the expected deployed commit, configured mail, confirmed delivery and a usable session | `scripts/verify-auth-production.mjs`; its regression cases run in `pnpm test`                           |

Run the production check from `docs/deploy.md` after an auth recovery deploy. It discovers Railway and Resend CLI access before sending a test code. Pending delivery fails the check and prints the email ID for a later check without resending.
