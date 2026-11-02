# Client address

The sign-in limits are keyed on the caller's address, which the api reads from
`X-Real-IP` (`advanced.ipAddress.ipAddressHeaders` in `apps/api/src/auth.ts`).
Railway's edge overwrites that header on every request, behind Cloudflare and
on the direct `*.up.railway.app` host alike, so a caller cannot choose it. See
Railway's public networking "Specs & Limits" page.

Railway also overwrites `X-Forwarded-For`, which holds only proxy hops, so the
api does not read it and keeps no proxy address list.

A request with no `X-Real-IP` (private networking) shares one bucket per path,
and the library logs `Rate limiting could not determine a client IP`. That
warning in production logs means the header is missing.
