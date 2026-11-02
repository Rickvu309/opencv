# Client address

The sign-in code limit is keyed on the caller's address. Railway appends the
address it sees to the end of `X-Forwarded-For` and keeps what the client sent,
so the api reads the chain from the right and skips Cloudflare, Railway and
private ranges (`apps/api/src/auth-client-ip.ts`). The first address left
over is the caller, and a forged entry sits to its left. This holds whether a
request comes through Cloudflare or straight to the `*.up.railway.app` host.

A new Cloudflare range must be added to that list. A request with no usable
address is limited by its email instead of sharing one bucket.
