# Proving production sign-in recovery

Local logged OTPs verify the local flow. To prove production recovery, use the
authenticated `railway` and `resend` CLIs already available on the machine before
asking someone for credentials. Resend can create a `sending_access` API key
restricted to the verified `opencv.me` domain. Set `RESEND_API_KEY` through
Railway's stdin input and `AUTH_EMAIL_FROM` to `opencv <no-reply@opencv.me>`;
never print or commit the key. The provider CLI used for verification also needs
permission to read sent emails; the app's sending key stays restricted.

After Railway deploys the expected commit, run this with an email you control:

```bash
node scripts/verify-auth-production.mjs \
  --commit "$(git rev-parse origin/main)" \
  --email '<your test email>' \
  --evidence "$HOME/tmp/opencv-auth-production.json"
```

This sends and consumes a real sign-in code, checks the resulting session, and
signs that verification session out. The receipt contains no key, OTP, cookie
or session token. Its file must not already exist. A success requires the
expected Railway API commit, mail configuration, a verified Resend domain,
provider-confirmed delivery of the exact message ID returned by sign-in, the
expected signed-in account, and an unusable session after sign-out. The API
returns the provider message ID only for sign-in, where both registered and
new addresses receive a code; other OTP flows keep their uniform response.

Queued mail is a failure to prove recovery, rather than a delivery success.
The command prints the email ID; check it later with the same arguments and
`--mail-id <id>` while the code is still valid. That check sends no new code.
The command performs no polling. Gmail or another recipient accepting delivery
does not establish which inbox folder the recipient displays it in.
