const SUBJECT = "Your opencv code"

type AuthCodeType =
  "sign-in" | "email-verification" | "forget-password" | "change-email"

type AuthCodeInput = {
  email: string
  otp: string
  type: AuthCodeType
}

function codeText(type: AuthCodeType, otp: string) {
  const line =
    type === "change-email"
      ? `Your opencv code to confirm the new email is ${otp}.`
      : `Your opencv code is ${otp}.`
  return [
    line,
    "",
    "It expires in 5 minutes.",
    "",
    "If you did not ask for this, you can ignore this email.",
  ].join("\n")
}

function failLine(email: string, type: string, status: number) {
  console.log(
    `[auth] email send failed for ${email} type ${type} status ${status}`
  )
}

/**
 * Resend when both values are set. Otherwise one log line and no network.
 * A failed send rejects so the caller can see the code was not delivered.
 * better-auth 1.7.1 still returns 200: it swallows that rejection.
 */
export function createAuthCodeSender({
  resendApiKey,
  from,
}: {
  resendApiKey?: string
  from?: string
}) {
  const key = resendApiKey?.trim()
  const sender = from?.trim()
  const useResend = Boolean(key && sender)

  return async function sendVerificationOTP({
    email,
    otp,
    type,
  }: AuthCodeInput) {
    const address = email.toLowerCase()
    if (!useResend || !key || !sender) {
      console.log(`[auth] email code for ${address} type ${type}: ${otp}`)
      return
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: sender,
          to: address,
          subject: SUBJECT,
          text: codeText(type, otp),
        }),
      })
      if (!res.ok) {
        failLine(address, type, res.status)
        throw new Error("auth email send failed")
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "auth email send failed"
      ) {
        throw error
      }
      failLine(address, type, 0)
      throw error
    }
  }
}
