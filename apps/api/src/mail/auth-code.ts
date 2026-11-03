import { z } from "zod"

const SUBJECT = "Your opencv code"

type AuthCodeType =
  "sign-in" | "email-verification" | "forget-password" | "change-email"

type AuthCodeInput = {
  email: string
  otp: string
  type: AuthCodeType
}

type AuthEndpointContext = {
  context?: object
}

const authMailFailure = Symbol("authMailFailure")
const authMailDelivery = Symbol("authMailDelivery")
const deliverySchema = z.object({ id: z.string().min(1) })

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

function markAuthMailFailed(ctx: AuthEndpointContext | undefined) {
  const target = ctx?.context
  if (!target) return
  Object.defineProperty(target, authMailFailure, {
    value: true,
    enumerable: false,
  })
}

export function authMailFailed(ctx: AuthEndpointContext | undefined) {
  const target = ctx?.context
  return Boolean(target && authMailFailure in target)
}

export function authMailId(ctx: AuthEndpointContext | undefined) {
  const target = ctx?.context
  if (!target || !(authMailDelivery in target)) return undefined
  const id = target[authMailDelivery]
  return typeof id === "string" ? id : undefined
}

function rejectAuthMail(ctx: AuthEndpointContext | undefined): never {
  markAuthMailFailed(ctx)
  throw new Error("auth email send failed")
}

type AuthMailConfig = {
  resendApiKey?: string
  from?: string
  logOtp: boolean
}

function authMailRoute({ resendApiKey, from, logOtp }: AuthMailConfig) {
  const key = resendApiKey?.trim()
  const sender = from?.trim()
  if (key && sender) return { kind: "resend", key, sender } as const
  return { kind: logOtp ? "log" : "none" } as const
}

export function authMailConfigured(config: AuthMailConfig) {
  return authMailRoute(config).kind !== "none"
}

export function createAuthCodeSender(config: AuthMailConfig) {
  const route = authMailRoute(config)

  return async function sendVerificationOTP(
    { email, otp, type }: AuthCodeInput,
    ctx?: AuthEndpointContext
  ) {
    const address = email.toLowerCase()
    if (route.kind === "log") {
      console.log(`[auth] email code for ${address} type ${type}: ${otp}`)
      return
    }
    if (route.kind === "none") {
      console.log("[auth] email send failed: mail is not configured")
      rejectAuthMail(ctx)
    }
    const { key, sender } = route

    let res: Response
    try {
      res = await fetch("https://api.resend.com/emails", {
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
    } catch {
      failLine(address, type, 0)
      rejectAuthMail(ctx)
    }
    if (!res.ok) {
      failLine(address, type, res.status)
      rejectAuthMail(ctx)
    }
    const delivery = deliverySchema.safeParse(
      await res.json().catch(() => null)
    )
    if (delivery.success && ctx?.context) {
      Object.defineProperty(ctx.context, authMailDelivery, {
        value: delivery.data.id,
      })
    }
  }
}
