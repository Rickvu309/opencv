export const SHARED_HELPER =
  ".claude/skills/verify-app-ui/scripts/lib/session.mjs"

export const SIGN_IN_UI_DRIVERS = Object.freeze({
  ".claude/skills/verify-app-ui/scripts/verify-auth-code.mjs":
    "its job is to check the sign-in form and the code screen, with the auth requests held",
  "scripts/verify-auth-production.mjs":
    "its job is to check a real sign-in against production",
  "scripts/verify-auth-production.test.mjs":
    "it tests the production sign-in check",
})

const OWN_SIGN_IN = [
  { pattern: /send-verification-otp/, what: "the send-code endpoint" },
  { pattern: /email-otp/, what: "the email code endpoints" },
  { pattern: /#sign-in-email/, what: "the sign-in form email field" },
  { pattern: /\[auth\] email code for/, what: "the api's logged sign-in code" },
]

export function ownSignIns(source) {
  return OWN_SIGN_IN.filter(({ pattern }) => pattern.test(source)).map(
    ({ what }) => what
  )
}

export function isDriverFile(file) {
  return (
    /^\.claude\/skills\/[^/]+\/scripts\/.+\.mjs$/.test(file) ||
    /^scripts\/verify-[^/]+\.mjs$/.test(file)
  )
}

export function signInProblems(file, source) {
  if (file === SHARED_HELPER || file in SIGN_IN_UI_DRIVERS) return []
  return ownSignIns(source).map(
    (what) =>
      `${file} reaches ${what} itself. The api allows 3 sign-in codes a minute, so every driver that signs in on its own risks a 429 on a shared stack. Call signInThrowaway from ${SHARED_HELPER}.`
  )
}
