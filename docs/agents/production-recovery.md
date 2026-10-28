# Production recovery

Production sign-in recovery needs these checks; a local OTP or HTTP 200 is insufficient.

| Rule                                                                                                                       | Enforced by                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The API production build must pass before merge                                                                            | `scripts/review-pr.sh` runs `pnpm --filter api... run build`; `scripts/test-review-pr.sh` rejects a failed build; the review cache key includes both production builds |
| A sign-in recovery receipt requires the expected deployed commit, configured mail, confirmed delivery and a usable session | `scripts/verify-auth-production.mjs`; its regression cases run in `pnpm test`                                                                                          |

Run the production check from `docs/deploy.md` after an auth recovery deploy. It discovers Railway and Resend CLI access before sending a test code. Pending delivery fails the check and prints the email ID for a later check without resending.
