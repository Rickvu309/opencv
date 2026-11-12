import { describe, expect, it } from "vitest"

import {
  LONGEST_CODE_LIMIT_HOLD_MS,
  MOST_HELD_ADDRESSES,
  codeLimitHoldMs,
  codeLimitLeftMs,
  initSignInState,
  signInReducer,
  type SignInAction,
  type SignInState,
} from "./sign-in-screen.reducer.ts"

const A = "ada@verify.local"
const B = "bea@verify.local"
const T0 = 1_000_000

function run(actions: SignInAction[], from?: SignInState) {
  return actions.reduce(signInReducer, from ?? initSignInState({}, "en"))
}

function refuse(address: string, now: number, waitMinutes: number | null = 2) {
  return [
    { type: "email_typed", value: address, now },
    { type: "send_started" },
    { type: "send_rejected", notice: "rate", waitMinutes, address, now },
    { type: "send_settled" },
  ] satisfies SignInAction[]
}

function held(state: SignInState) {
  return codeLimitLeftMs(state.holds, state.email, state.now) > 0
}

describe("code limit hold in the sign-in reducer", () => {
  it.each([
    [null, null],
    [0, null],
    [-3, null],
    [Number.NaN, null],
    [Number.POSITIVE_INFINITY, null],
    [2, 120_000],
    [11.02, 661_200],
    [1e12, LONGEST_CODE_LIMIT_HOLD_MS],
  ])("holds %s minutes for %s ms", (minutes, ms) => {
    expect(codeLimitHoldMs(minutes)).toBe(ms)
  })

  it("holds only the refused address and keys it without case or spaces", () => {
    const state = run(refuse(A, T0))
    expect(held(state)).toBe(true)
    expect(state.notice).toBe("rate")
    const other = run([{ type: "email_typed", value: B, now: T0 + 1 }], state)
    expect(held(other)).toBe(false)
    expect(other.notice).toBeNull()
    const back = run(
      [{ type: "email_typed", value: `  ${A.toUpperCase()} `, now: T0 + 2 }],
      other
    )
    expect(held(back)).toBe(true)
    expect(back.notice).toBe("rate")
  })

  it("clears the notice on the tick that reaches the end of the wait, not before", () => {
    const state = run(refuse(A, T0))
    const before = run([{ type: "clock_ticked", now: T0 + 119_999 }], state)
    expect(held(before)).toBe(true)
    expect(before.notice).toBe("rate")
    const at = run([{ type: "clock_ticked", now: T0 + 120_000 }], before)
    expect(held(at)).toBe(false)
    expect(at.notice).toBeNull()
    expect(at.holds).toEqual({})
  })

  it("keeps a refusal without a wait on screen until the address changes", () => {
    const state = run(refuse(A, T0, null))
    expect(held(state)).toBe(false)
    const later = run([{ type: "clock_ticked", now: T0 + 3_600_000 }], state)
    expect(later.notice).toBe("rate")
    const other = run([{ type: "email_typed", value: B, now: T0 + 1 }], later)
    expect(other.notice).toBeNull()
  })

  it("does not let a clock set back stretch the hold past an hour", () => {
    const state = run(refuse(A, T0, 60))
    const behind = run(
      [{ type: "clock_ticked", now: T0 - 10 * 3_600_000 }],
      state
    )
    expect(codeLimitLeftMs(behind.holds, A, behind.now)).toBe(
      LONGEST_CODE_LIMIT_HOLD_MS
    )
  })

  it("keeps at most a few held addresses, dropping the oldest", () => {
    const addresses = Array.from(
      { length: MOST_HELD_ADDRESSES + 2 },
      (_, index) => `person${index}@verify.local`
    )
    const state = run(addresses.flatMap((address) => refuse(address, T0)))
    expect(Object.keys(state.holds)).toEqual(
      addresses.slice(-MOST_HELD_ADDRESSES)
    )
  })

  it("comes back to the email step focused, showing the hold of the kept address", () => {
    const state = run([
      ...refuse(A, T0),
      { type: "email_typed", value: B, now: T0 + 1 },
      { type: "send_started" },
      { type: "send_succeeded", address: B },
      { type: "send_settled" },
      { type: "email_change_requested", now: T0 + 2 },
    ])
    expect(state.step).toBe("email")
    expect(state.email).toBe(B)
    expect(state.emailFocusNonce).toBe(1)
    expect(state.notice).toBeNull()
    const toA = run([{ type: "email_typed", value: A, now: T0 + 3 }], state)
    expect(held(toA)).toBe(true)
    expect(toA.notice).toBe("rate")
  })

  it("shows the hold again when going back to a held address from the code step", () => {
    const resendRefused = run([
      { type: "email_typed", value: A, now: T0 },
      { type: "send_started" },
      { type: "send_succeeded", address: A },
      { type: "send_settled" },
      { type: "send_started" },
      {
        type: "send_rejected",
        notice: "rate",
        waitMinutes: 2,
        address: A,
        now: T0 + 1,
      },
      { type: "send_settled" },
      { type: "email_change_requested", now: T0 + 2 },
    ])
    expect(resendRefused.step).toBe("email")
    expect(held(resendRefused)).toBe(true)
    expect(resendRefused.notice).toBe("rate")
  })
})
