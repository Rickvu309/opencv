import { describe, expect, it } from "vitest"

import {
  isAuthPath,
  redirectFromSearch,
  safeRedirectPath,
  signInHref,
  validateAuthSearch,
} from "./auth-redirect.ts"

describe("safeRedirectPath", () => {
  it("keeps in-app surface paths", () => {
    expect(safeRedirectPath("/app/paper")).toBe("/app/paper")
    expect(safeRedirectPath("/app/settings?tab=account")).toBe(
      "/app/settings?tab=account"
    )
  })

  it("rejects off-origin and auth-screen loops", () => {
    expect(safeRedirectPath("https://attacker.example")).toBeUndefined()
    expect(safeRedirectPath("//attacker.example")).toBeUndefined()
    expect(safeRedirectPath("/sign-in")).toBeUndefined()
    expect(safeRedirectPath("/sign-up")).toBeUndefined()
    expect(safeRedirectPath("/sign-in?redirect=/app")).toBeUndefined()
  })
})

describe("validateAuthSearch", () => {
  it("drops an unsafe redirect", () => {
    expect(validateAuthSearch({ redirect: "https://evil.test" })).toEqual({})
    expect(validateAuthSearch({ redirect: "/app/apply" })).toEqual({
      redirect: "/app/apply",
    })
    expect(
      validateAuthSearch({ email: "ada@verify.local", error: "google" })
    ).toEqual({
      email: "ada@verify.local",
      error: "google",
    })
    expect(
      validateAuthSearch({ email: "not-an-email", error: "nope" })
    ).toEqual({})
  })
})

describe("redirectFromSearch", () => {
  it("reads a safe redirect from parsed search", () => {
    expect(redirectFromSearch({ redirect: "/app/paper" })).toBe("/app/paper")
    expect(
      redirectFromSearch({ redirect: "https://evil.test" })
    ).toBeUndefined()
  })
})

describe("signInHref", () => {
  it("preserves the originally requested surface", () => {
    expect(signInHref("/app/paper")).toBe("/sign-in?redirect=%2Fapp%2Fpaper")
  })

  it("does not loop on auth screens or Home", () => {
    expect(signInHref("/sign-in")).toBe("/sign-in")
    expect(signInHref("/sign-up")).toBe("/sign-in")
    expect(signInHref("/app")).toBe("/sign-in")
    expect(isAuthPath("/sign-up")).toBe(true)
  })
})
