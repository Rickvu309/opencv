export const AUTH_COPY = {
  logIn: "Log in to opencv",
  google: "Continue with Google",
  or: "or",
  email: "Email",
  emailPlaceholder: "Enter your email address",
  continue: "Continue",
  terms: "By continuing, you agree to the Terms of Service and Privacy Policy.",
  hero1: "Write your CV with a coach.",
  hero2: "Track every application.",
  language: "Language",
  en: "EN",
  vi: "VI",
  checkEmail: "Check your email",
  sentTo: "We sent a 6-digit code to",
  change: "Change",
  openEmail: "Open email",
  didntGet: "Didn't get it?",
  sendNew: "Send a new code",
  verifying: "Verifying…",
  codeBad: "That code is incorrect or expired.",
  tooManyTries: "Too many tries. Send a new code.",
  tooManyCodes: "Too many codes. Wait a minute and try again.",
  sendFailed: "We could not send the code. Try again.",
  emailInvalid: "Use a full email, like name@example.com.",
  googleUnavailable: "Google sign-in is not available. Use your email.",
  welcome: "Welcome to OpenCV",
  accountCreated: "Account created",
  workspaceReady: "Workspace ready",
  coachReady: "Getting your coach ready",
  loggedOutTitle: "You've been logged out",
  loggedOutBody: "Log in again. Your work is saved.",
  emailMe: "Email me a code",
  logOut: "Log out",
  codeGroup: "Email code",
} as const

export const LANGUAGE_STORAGE_KEY = "opencv.language"

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function resendLabel(seconds: number) {
  const remain = Math.max(0, seconds)
  const mins = Math.floor(remain / 60)
  const secs = String(remain % 60).padStart(2, "0")
  return `Resend in ${mins}:${secs}`
}

export function continueAsLabel(email: string) {
  return `Continue as ${email}`
}

const WEBMAIL: Record<string, string> = {
  "gmail.com": "https://mail.google.com/",
  "googlemail.com": "https://mail.google.com/",
  "outlook.com": "https://outlook.live.com/mail/",
  "hotmail.com": "https://outlook.live.com/mail/",
  "live.com": "https://outlook.live.com/mail/",
  "msn.com": "https://outlook.live.com/mail/",
  "yahoo.com": "https://mail.yahoo.com/",
  "ymail.com": "https://mail.yahoo.com/",
  "icloud.com": "https://www.icloud.com/mail/",
  "me.com": "https://www.icloud.com/mail/",
  "mac.com": "https://www.icloud.com/mail/",
}

export function openEmailHref(email: string) {
  const domain = email.trim().toLowerCase().split("@")[1] ?? ""
  return WEBMAIL[domain] ?? null
}

export function readLanguage(): "en" | "vi" {
  if (typeof sessionStorage === "undefined") return "en"
  return sessionStorage.getItem(LANGUAGE_STORAGE_KEY) === "vi" ? "vi" : "en"
}

export function storeLanguage(value: "en" | "vi") {
  sessionStorage.setItem(LANGUAGE_STORAGE_KEY, value)
}
