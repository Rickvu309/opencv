import { afterEach, describe, expect, it, vi } from "vitest"

import { authMailConfigured, createAuthCodeSender } from "./auth-code.js"

const inputs = [
  { logOtp: false },
  { logOtp: true },
  { resendApiKey: "re_key", logOtp: false },
  { from: "hi@opencv.me", logOtp: false },
  { resendApiKey: "  ", from: "hi@opencv.me", logOtp: false },
  { resendApiKey: "re_key", from: " ", logOtp: true },
  { resendApiKey: "re_key", from: "hi@opencv.me", logOtp: false },
  { resendApiKey: "re_key", from: "hi@opencv.me", logOtp: true },
]

describe("authMailConfigured", () => {
  afterEach(() => vi.restoreAllMocks())

  it.each(inputs)("agrees with the sender for %j", async (config) => {
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ id: "mail_1" }))
    )
    const send = createAuthCodeSender(config)

    const delivered = await send({
      email: "a@b.co",
      otp: "123456",
      type: "sign-in",
    }).then(
      () => true,
      () => false
    )

    expect(authMailConfigured(config)).toBe(delivered)
  })
})
